import { ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

import { DATA_DIR, MAX_CONCURRENT_CONTAINERS } from './config.js';
import { stopContainer } from './container-runtime.js';
import { logger } from './logger.js';

interface QueuedTask {
  id: string;
  workspaceFolder: string;
  fn: () => Promise<void>;
}

const MAX_RETRIES = 5;
const BASE_RETRY_MS = 5000;

interface WorkspaceState {
  active: boolean;
  pendingMessages: boolean;
  pendingTasks: QueuedTask[];
  process: ChildProcess | null;
  containerName: string | null;
  ipcFolder: string | null;
  retryCount: number;
}

export class GroupQueue {
  private workspaces = new Map<string, WorkspaceState>();
  private activeCount = 0;
  private waitingWorkspaces: string[] = [];
  private processMessagesFn: ((workspaceFolder: string) => Promise<boolean>) | null =
    null;
  private shuttingDown = false;

  private getWorkspace(workspaceFolder: string): WorkspaceState {
    let state = this.workspaces.get(workspaceFolder);
    if (!state) {
      state = {
        active: false,
        pendingMessages: false,
        pendingTasks: [],
        process: null,
        containerName: null,
        ipcFolder: null,
        retryCount: 0,
      };
      this.workspaces.set(workspaceFolder, state);
    }
    return state;
  }

  setProcessMessagesFn(fn: (workspaceFolder: string) => Promise<boolean>): void {
    this.processMessagesFn = fn;
  }

  enqueueMessageCheck(workspaceFolder: string): void {
    if (this.shuttingDown) return;

    const state = this.getWorkspace(workspaceFolder);

    if (state.active) {
      state.pendingMessages = true;
      this.closeStdin(workspaceFolder);
      logger.debug({ workspaceFolder }, 'Workspace active, message queued');
      return;
    }

    if (this.activeCount >= MAX_CONCURRENT_CONTAINERS) {
      state.pendingMessages = true;
      if (!this.waitingWorkspaces.includes(workspaceFolder)) {
        this.waitingWorkspaces.push(workspaceFolder);
      }
      logger.debug(
        { workspaceFolder, activeCount: this.activeCount },
        'At concurrency limit, workspace message queued',
      );
      return;
    }

    this.runForWorkspace(workspaceFolder, 'messages');
  }

  enqueueTask(workspaceFolder: string, taskId: string, fn: () => Promise<void>): void {
    if (this.shuttingDown) return;

    const state = this.getWorkspace(workspaceFolder);

    if (state.pendingTasks.some((t) => t.id === taskId)) {
      logger.debug({ workspaceFolder, taskId }, 'Task already queued, skipping');
      return;
    }

    if (state.active) {
      state.pendingTasks.push({ id: taskId, workspaceFolder, fn });
      logger.debug({ workspaceFolder, taskId }, 'Workspace active, task queued');
      return;
    }

    if (this.activeCount >= MAX_CONCURRENT_CONTAINERS) {
      state.pendingTasks.push({ id: taskId, workspaceFolder, fn });
      if (!this.waitingWorkspaces.includes(workspaceFolder)) {
        this.waitingWorkspaces.push(workspaceFolder);
      }
      logger.debug(
        { workspaceFolder, taskId, activeCount: this.activeCount },
        'At concurrency limit, task queued',
      );
      return;
    }

    this.runTask(workspaceFolder, { id: taskId, workspaceFolder, fn });
  }

  registerProcess(
    workspaceFolder: string,
    proc: ChildProcess,
    containerName: string,
    ipcFolder?: string,
  ): void {
    const state = this.getWorkspace(workspaceFolder);
    state.process = proc;
    state.containerName = containerName;
    if (ipcFolder) state.ipcFolder = ipcFolder;
  }

  sendMessage(workspaceFolder: string, text: string): boolean {
    const state = this.getWorkspace(workspaceFolder);
    if (!state.active || !state.ipcFolder) return false;

    const inputDir = path.join(DATA_DIR, 'ipc', state.ipcFolder, 'input');
    try {
      fs.mkdirSync(inputDir, { recursive: true });
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
      const filepath = path.join(inputDir, filename);
      const tempPath = `${filepath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify({ type: 'message', text }));
      fs.renameSync(tempPath, filepath);
      return true;
    } catch {
      return false;
    }
  }

  closeStdin(workspaceFolder: string): void {
    const state = this.getWorkspace(workspaceFolder);
    if (!state.active || !state.ipcFolder) return;

    const inputDir = path.join(DATA_DIR, 'ipc', state.ipcFolder, 'input');
    try {
      fs.mkdirSync(inputDir, { recursive: true });
      fs.writeFileSync(path.join(inputDir, '_close'), '');
    } catch {
      // ignore
    }
  }

  private async runForWorkspace(
    workspaceFolder: string,
    reason: 'messages' | 'drain',
  ): Promise<void> {
    const state = this.getWorkspace(workspaceFolder);
    state.active = true;
    state.pendingMessages = false;
    this.activeCount++;

    logger.debug(
      { workspaceFolder, reason, activeCount: this.activeCount },
      'Starting container for workspace',
    );

    try {
      if (this.processMessagesFn) {
        const success = await this.processMessagesFn(workspaceFolder);
        if (success) {
          state.retryCount = 0;
        } else {
          this.scheduleRetry(workspaceFolder, state);
        }
      }
    } catch (err) {
      logger.error({ workspaceFolder, err }, 'Error processing messages for workspace');
      this.scheduleRetry(workspaceFolder, state);
    } finally {
      state.active = false;
      state.process = null;
      state.containerName = null;
      state.ipcFolder = null;
      this.activeCount--;
      this.drainWorkspace(workspaceFolder);
    }
  }

  private async runTask(workspaceFolder: string, task: QueuedTask): Promise<void> {
    const state = this.getWorkspace(workspaceFolder);
    state.active = true;
    this.activeCount++;

    logger.debug(
      { workspaceFolder, taskId: task.id, activeCount: this.activeCount },
      'Running queued task',
    );

    try {
      await task.fn();
    } catch (err) {
      logger.error({ workspaceFolder, taskId: task.id, err }, 'Error running task');
    } finally {
      state.active = false;
      state.process = null;
      state.containerName = null;
      state.ipcFolder = null;
      this.activeCount--;
      this.drainWorkspace(workspaceFolder);
    }
  }

  private scheduleRetry(workspaceFolder: string, state: WorkspaceState): void {
    state.retryCount++;
    if (state.retryCount > MAX_RETRIES) {
      logger.error(
        { workspaceFolder, retryCount: state.retryCount },
        'Max retries exceeded, dropping workspace messages (will retry on next incoming message)',
      );
      state.retryCount = 0;
      return;
    }

    const delayMs = BASE_RETRY_MS * Math.pow(2, state.retryCount - 1);
    logger.info(
      { workspaceFolder, retryCount: state.retryCount, delayMs },
      'Scheduling retry with backoff',
    );
    setTimeout(() => {
      if (!this.shuttingDown) {
        this.enqueueMessageCheck(workspaceFolder);
      }
    }, delayMs);
  }

  private drainWorkspace(workspaceFolder: string): void {
    if (this.shuttingDown) return;

    const state = this.getWorkspace(workspaceFolder);

    if (state.pendingTasks.length > 0) {
      const task = state.pendingTasks.shift()!;
      this.runTask(workspaceFolder, task);
      return;
    }

    if (state.pendingMessages) {
      this.runForWorkspace(workspaceFolder, 'drain');
      return;
    }

    this.drainWaiting();
  }

  private drainWaiting(): void {
    while (
      this.waitingWorkspaces.length > 0 &&
      this.activeCount < MAX_CONCURRENT_CONTAINERS
    ) {
      const nextWorkspace = this.waitingWorkspaces.shift()!;
      const state = this.getWorkspace(nextWorkspace);

      if (state.pendingTasks.length > 0) {
        const task = state.pendingTasks.shift()!;
        this.runTask(nextWorkspace, task);
      } else if (state.pendingMessages) {
        this.runForWorkspace(nextWorkspace, 'drain');
      }
    }
  }

  async shutdown(gracePeriodMs: number): Promise<void> {
    this.shuttingDown = true;

    const activeEntries: { name: string; proc: ChildProcess | null }[] = [];
    for (const [, state] of this.workspaces) {
      if (state.process && !state.process.killed && state.containerName) {
        activeEntries.push({ name: state.containerName, proc: state.process });
      }
    }

    if (activeEntries.length === 0) {
      logger.info('GroupQueue shutting down (no active containers)');
      return;
    }

    logger.info(
      {
        activeCount: this.activeCount,
        containers: activeEntries.map((entry) => entry.name),
      },
      'GroupQueue shutting down, stopping containers...',
    );

    const stopPromises = activeEntries.map(({ name, proc }) =>
      new Promise<void>((resolve) => {
        try {
          stopContainer(name, proc, gracePeriodMs);
          logger.info({ container: name }, 'Container stopped');
        } catch {
          logger.warn({ container: name }, 'Container stop failed or timed out');
        }
        resolve();
      }),
    );

    await Promise.all(stopPromises);
    logger.info('All containers stopped');
  }
}
