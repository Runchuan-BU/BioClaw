import { RegisteredGroup } from './types.js';

export function getWorkspaceFolder(
  group: Pick<RegisteredGroup, 'folder' | 'workspaceFolder'>,
): string {
  return group.workspaceFolder || group.folder;
}

export function normalizeRegisteredGroup(group: RegisteredGroup): RegisteredGroup {
  return {
    ...group,
    workspaceFolder: getWorkspaceFolder(group),
  };
}

export function getWorkspaceChatJids(
  groups: Record<string, RegisteredGroup>,
  workspaceFolder: string,
): string[] {
  return Object.entries(groups)
    .filter(([, group]) => getWorkspaceFolder(group) === workspaceFolder)
    .map(([jid]) => jid);
}

export function getWorkspaceGroups(
  groups: Record<string, RegisteredGroup>,
  workspaceFolder: string,
): Array<[string, RegisteredGroup]> {
  return Object.entries(groups).filter(
    ([, group]) => getWorkspaceFolder(group) === workspaceFolder,
  );
}

export function getRuntimeGroupForWorkspace(
  groups: Record<string, RegisteredGroup>,
  workspaceFolder: string,
  preferredChatJid?: string,
): RegisteredGroup | undefined {
  const workspaceGroups = getWorkspaceGroups(groups, workspaceFolder);
  if (workspaceGroups.length === 0) return undefined;

  const preferred = preferredChatJid ? groups[preferredChatJid] : undefined;
  const withConfig = workspaceGroups.find(([, group]) => group.containerConfig)?.[1];
  const base = preferred || withConfig || workspaceGroups[0][1];

  return normalizeRegisteredGroup({
    ...base,
    folder: workspaceFolder,
    workspaceFolder,
  });
}
