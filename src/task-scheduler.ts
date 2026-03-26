import { ChildProcess } from 'child_process';
import { CronExpressionParser } from 'cron-parser';
import fs from 'fs';
import path from 'path';

import {
  GROUPS_DIR,
  IDLE_TIMEOUT,
  MAIN_GROUP_FOLDER,
  SCHEDULER_POLL_INTERVAL,
  TIMEZONE,
} from './config.js';
import { recordAgentTraceEvent } from './agent-trace.js';
import { ContainerOutput, runContainerAgent } from './container-runner.js';
import { writeTasksSnapshot } from './group-folder.js';
import {
  getAllTasks,
  getDueTasks,
  getTaskById,
  logTaskRun,
  updateTaskAfterRun,
} from './db/index.js';
import { GroupQueue } from './group-queue.js';
import { logger } from './logger.js';
import { RegisteredGroup, ScheduledTask } from './types.js';
import { getRuntimeGroupForWorkspace } from './workspace.js';

export interface SchedulerDependencies {
  registeredGroups: () => Record<string, RegisteredGroup>;
  getSessions: () => Record<string, string>;
  getAgentWorkspaceFolder: (agentId: string) => string | undefined;
  queue: GroupQueue;
  onProcess: (
    agentId: string,
    proc: ChildProcess,
    containerName: string,
    ipcFolder: string,
  ) => void;
  sendMessage: (jid: string, text: string) => Promise<void>;
}

async function runTask(
  task: ScheduledTask,
  deps: SchedulerDependencies,
): Promise<void> {
  const startTime = Date.now();
  const agentId = task.agent_id || task.group_folder;
  const workspaceFolder =
    deps.getAgentWorkspaceFolder(agentId) || task.group_folder;
  const groupDir = path.join(GROUPS_DIR, workspaceFolder);
  fs.mkdirSync(groupDir, { recursive: true });

  logger.info(
    { taskId: task.id, agentId, workspaceFolder },
    'Running scheduled task',
  );

  const groups = deps.registeredGroups();
  const group = getRuntimeGroupForWorkspace(
    groups,
    workspaceFolder,
    task.chat_jid,
  );

  if (!group) {
    logger.error(
      { taskId: task.id, groupFolder: workspaceFolder, agentId },
      'Group not found for task',
    );
    logTaskRun({
      task_id: task.id,
      run_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      status: 'error',
      result: null,
      error: `Group not found: ${task.group_folder}`,
    });
    return;
  }

  // Update tasks snapshot for container to read (filtered by group)
  const isMain = workspaceFolder === MAIN_GROUP_FOLDER;
  const tasks = getAllTasks();
  writeTasksSnapshot(
    agentId,
    isMain,
    tasks.map((t) => ({
      id: t.id,
      groupFolder: t.agent_id || t.group_folder,
      prompt: t.prompt,
      schedule_type: t.schedule_type,
      schedule_value: t.schedule_value,
      status: t.status,
      next_run: t.next_run,
    })),
  );

  let result: string | null = null;
  let error: string | null = null;

  // For group context mode, use the group's current session
  const sessions = deps.getSessions();
  const sessionId =
    task.context_mode === 'group' ? sessions[agentId] : undefined;

  // Idle timer: writes _close sentinel after IDLE_TIMEOUT of no output,
  // so the container exits instead of hanging at waitForIpcMessage forever.
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      logger.debug({ taskId: task.id }, 'Scheduled task idle timeout, closing container stdin');
      deps.queue.closeStdin(agentId);
    }, IDLE_TIMEOUT);
  };

  try {
    recordAgentTraceEvent({
      group_folder: workspaceFolder,
      chat_jid: task.chat_jid,
      session_id: sessionId ?? null,
      type: 'scheduled_run_start',
      payload: {
        taskId: task.id,
        promptPreview: task.prompt.slice(0, 500),
      },
    });

    const output = await runContainerAgent(
      group,
      {
        prompt: task.prompt,
        sessionId,
        groupFolder: workspaceFolder,
        agentId,
        chatJid: task.chat_jid,
        isMain,
        isScheduledTask: true,
      },
      (proc, containerName) =>
        deps.onProcess(agentId, proc, containerName, agentId),
      async (streamedOutput: ContainerOutput) => {
        const r =
          streamedOutput.result == null
            ? ''
            : typeof streamedOutput.result === 'string'
              ? streamedOutput.result
              : JSON.stringify(streamedOutput.result);
        recordAgentTraceEvent({
          group_folder: workspaceFolder,
          chat_jid: task.chat_jid,
          session_id: sessionId ?? null,
          type: 'stream_output',
          payload: {
            source: 'scheduler',
            taskId: task.id,
            status: streamedOutput.status,
            resultLength: r.length,
            preview: r.replace(/<internal>[\s\S]*?<\/internal>/g, '').slice(0, 800),
          },
        });
        if (streamedOutput.result) {
          result = streamedOutput.result;
          // Forward result to user (sendMessage handles formatting)
          await deps.sendMessage(task.chat_jid, streamedOutput.result);
          // Only reset idle timer on actual results, not session-update markers
          resetIdleTimer();
        }
        if (streamedOutput.status === 'error') {
          error = streamedOutput.error || 'Unknown error';
        }
      },
    );

    if (idleTimer) clearTimeout(idleTimer);

    if (output.status === 'error') {
      error = output.error || 'Unknown error';
    } else if (output.result) {
      // Messages are sent via MCP tool (IPC), result text is just logged
      result = output.result;
    }

    recordAgentTraceEvent({
      group_folder: workspaceFolder,
      chat_jid: task.chat_jid,
      session_id: sessionId ?? null,
      type: 'scheduled_run_end',
      payload: {
        taskId: task.id,
        status: error ? 'error' : 'success',
        error,
      },
    });

    logger.info(
      { taskId: task.id, durationMs: Date.now() - startTime },
      'Task completed',
    );
  } catch (err) {
    if (idleTimer) clearTimeout(idleTimer);
    error = err instanceof Error ? err.message : String(err);
    recordAgentTraceEvent({
      group_folder: workspaceFolder,
      chat_jid: task.chat_jid,
      session_id: sessionId ?? null,
      type: 'scheduled_run_error',
      payload: { taskId: task.id, message: error },
    });
    logger.error({ taskId: task.id, error }, 'Task failed');
  }

  const durationMs = Date.now() - startTime;

  logTaskRun({
    task_id: task.id,
    run_at: new Date().toISOString(),
    duration_ms: durationMs,
    status: error ? 'error' : 'success',
    result,
    error,
  });

  let nextRun: string | null = null;
  if (task.schedule_type === 'cron') {
    const interval = CronExpressionParser.parse(task.schedule_value, {
      tz: TIMEZONE,
    });
    nextRun = interval.next().toISOString();
  } else if (task.schedule_type === 'interval') {
    const ms = parseInt(task.schedule_value, 10);
    nextRun = new Date(Date.now() + ms).toISOString();
  }
  // 'once' tasks have no next run

  const resultSummary = error
    ? `Error: ${error}`
    : result
      ? result.slice(0, 200)
      : 'Completed';
  updateTaskAfterRun(task.id, nextRun, resultSummary);
}

let schedulerRunning = false;

export function startSchedulerLoop(deps: SchedulerDependencies): void {
  if (schedulerRunning) {
    logger.debug('Scheduler loop already running, skipping duplicate start');
    return;
  }
  schedulerRunning = true;
  logger.info('Scheduler loop started');

  const loop = async () => {
    try {
      const dueTasks = getDueTasks();
      if (dueTasks.length > 0) {
        logger.info({ count: dueTasks.length }, 'Found due tasks');
      }

      for (const task of dueTasks) {
        // Re-check task status in case it was paused/cancelled
        const currentTask = getTaskById(task.id);
        if (!currentTask || currentTask.status !== 'active') {
          continue;
        }

        deps.queue.enqueueTask(
          currentTask.agent_id || currentTask.group_folder,
          currentTask.id,
          () => runTask(currentTask, deps),
        );
      }
    } catch (err) {
      logger.error({ err }, 'Error in scheduler loop');
    }

    setTimeout(loop, SCHEDULER_POLL_INTERVAL);
  };

  loop();
}
