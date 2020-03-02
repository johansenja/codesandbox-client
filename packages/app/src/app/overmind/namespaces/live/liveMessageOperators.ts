import { getModulesAndDirectoriesInDirectory } from '@codesandbox/common/lib/sandbox/modules';
import {
  Directory,
  LiveDisconnectReason,
  LiveMessage,
  LiveUser,
  Module,
  UserSelection,
} from '@codesandbox/common/lib/types';
import { logError } from '@codesandbox/common/lib/utils/analytics';
import { NotificationStatus } from '@codesandbox/notifications/lib/state';
import { Operator } from 'app/overmind';
import { camelizeKeys } from 'humps';
import { json, mutate } from 'overmind';

export const onJoin: Operator<LiveMessage<{
  status: 'connected';
  live_user_id: string;
}>> = mutate(({ effects, state }, { data }) => {
  state.live.liveUserId = data.live_user_id;

  // Show message to confirm that you've joined a live session if you're not the owner
  if (!state.live.isCurrentEditor) {
    effects.notificationToast.success('Connected to Live!');
  }

  if (state.live.reconnecting) {
    effects.live.getAllClients().forEach(client => {
      client.serverReconnect();
    });
  }

  state.live.reconnecting = false;
});

export const onModuleState: Operator<LiveMessage<{
  module_state: any;
}>> = mutate(({ state, actions }, { data }) => {
  actions.live.internal.initializeModuleState(data.module_state);
});

export const onExternalResources: Operator<LiveMessage<{
  externalResources: string[];
}>> = mutate(({ state, actions }, { data }) => {
  if (!state.editor.sandbox) {
    return;
  }
  state.editor.sandbox.setExternalResources(data.externalResources);
  actions.editor.internal.updatePreviewCode();
});

export const onUserEntered: Operator<LiveMessage<{
  users: LiveUser[];
  editor_ids: string[];
  owner_ids: string[];
  joined_user_id: string;
}>> = mutate(({ state, effects, actions }, { data }) => {
  if (state.live.isLoading || !state.live.roomInfo || !state.live.isLive) {
    return;
  }

  const users = camelizeKeys(data.users);
  const sandbox = state.editor.sandbox;

  state.live.roomInfo.users = users as LiveUser[];
  state.live.roomInfo.editorIds = data.editor_ids;
  state.live.roomInfo.ownerIds = data.owner_ids;

  if (sandbox.currentModule) {
    effects.vscode.updateUserSelections(
      sandbox.currentModule,
      actions.live.internal.getSelectionsForModule(sandbox.currentModule)
    );
  }

  // Send our own selections to everyone, just to let the others know where
  // we are
  actions.live.sendCurrentSelection();

  if (data.joined_user_id === state.live.liveUserId) {
    return;
  }

  const user = data.users.find(u => u.id === data.joined_user_id);

  if (!state.live.notificationsHidden && user) {
    effects.notificationToast.add({
      message: `${user.username} joined the live session.`,
      status: NotificationStatus.NOTICE,
    });
  }
});

export const onUserLeft: Operator<LiveMessage<{
  users: LiveUser[];
  left_user_id: string;
  editor_ids: string[];
  owner_ids: string[];
}>> = mutate(({ state, actions, effects }, { data }) => {
  if (!state.live.roomInfo) {
    return;
  }

  if (!state.live.notificationsHidden) {
    const { users } = state.live.roomInfo;
    const user = users ? users.find(u => u.id === data.left_user_id) : null;

    if (user && user.id !== state.live.liveUserId) {
      effects.notificationToast.add({
        message: `${user.username} left the live session.`,
        status: NotificationStatus.NOTICE,
      });
    }
  }

  actions.live.internal.clearUserSelections(data.left_user_id);

  const users = camelizeKeys(data.users) as LiveUser[];

  state.live.roomInfo.users = users;
  state.live.roomInfo.ownerIds = data.owner_ids;
  state.live.roomInfo.editorIds = data.editor_ids;
});

export const onModuleSaved: Operator<LiveMessage<{
  moduleShortid: string;
  module: Module;
}>> = mutate(({ state, effects, actions }, { _isOwnMessage, data }) => {
  if (_isOwnMessage || !state.editor.sandbox) {
    return;
  }
  const module = state.editor.sandbox.modules.find(
    moduleItem => moduleItem.shortid === data.moduleShortid
  );

  if (module) {
    module.isNotSynced = false;

    actions.editor.internal.setModuleSavedCode({
      moduleShortid: data.moduleShortid,
      savedCode: data.module.savedCode,
    });

    effects.vscode.sandboxFsSync.writeFile(state.editor.modulesByPath, module);
    // We revert the module so that VSCode will flag saved indication correctly
    effects.vscode.revertModule(module);
    actions.editor.internal.updatePreviewCode();
  }
});

export const onModuleCreated: Operator<LiveMessage<{
  module: Module;
}>> = mutate(({ state, effects }, { _isOwnMessage, data }) => {
  if (_isOwnMessage || !state.editor.sandbox) {
    return;
  }
  state.editor.sandbox.modules.push(data.module);
  effects.vscode.sandboxFsSync.writeFile(
    state.editor.modulesByPath,
    data.module
  );
});

export const onModuleMassCreated: Operator<LiveMessage<{
  modules: Module[];
  directories: Directory[];
}>> = mutate(({ state, actions, effects }, { _isOwnMessage, data }) => {
  if (_isOwnMessage || !state.editor.sandbox) {
    return;
  }
  const sandbox = state.editor.sandbox;
  sandbox.addModules(data.modules);
  sandbox.addDirectories(data.directories);

  state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
    sandbox.get()
  );

  actions.editor.internal.updatePreviewCode();
});

export const onModuleUpdated: Operator<LiveMessage<{
  moduleShortid: string;
  module: Module;
}>> = mutate(({ state, actions, effects }, { _isOwnMessage, data }) => {
  const sandbox = state.editor.sandbox;

  if (_isOwnMessage || !sandbox) {
    return;
  }

  const moduleIndex = sandbox.modules.findIndex(
    moduleEntry => moduleEntry.shortid === data.moduleShortid
  );
  const existingModule = sandbox.modules[moduleIndex];

  if (existingModule.path !== data.module.path) {
    effects.vscode.sandboxFsSync.rename(
      state.editor.modulesByPath,
      existingModule.path!,
      data.module.path!
    );
  }

  Object.assign(existingModule, data.module);

  effects.vscode.sandboxFsSync.writeFile(
    state.editor.modulesByPath,
    existingModule
  );

  if (
    !sandbox.currentModule ||
    sandbox.currentModule.shortid === data.moduleShortid
  ) {
    effects.vscode.openModule(existingModule);
  }

  actions.editor.internal.updatePreviewCode();
});

export const onModuleDeleted: Operator<LiveMessage<{
  moduleShortid: string;
}>> = mutate(({ state, effects, actions }, { _isOwnMessage, data }) => {
  if (_isOwnMessage || !state.editor.sandbox) {
    return;
  }
  const sandbox = state.editor.sandbox;
  const removedModule = state.editor.sandbox.modules.find(
    directory => directory.shortid === data.moduleShortid
  );
  if (!removedModule) {
    return;
  }
  const moduleIndex = state.editor.sandbox.modules.indexOf(removedModule);
  const wasCurrentModule = sandbox.currentModule.shortid === data.moduleShortid;

  state.editor.sandbox.modules.splice(moduleIndex, 1);
  effects.vscode.sandboxFsSync.unlink(
    state.editor.modulesByPath,
    removedModule
  );

  if (wasCurrentModule && sandbox.mainModule) {
    actions.editor.internal.setCurrentModule(sandbox.mainModule);
  }

  actions.editor.internal.updatePreviewCode();
});

export const onDirectoryCreated: Operator<LiveMessage<{
  module: Directory; // This is very weird?
}>> = mutate(({ state, effects }, { _isOwnMessage, data }) => {
  if (_isOwnMessage || !state.editor.sandbox) {
    return;
  }
  // Should this not be a directory?
  state.editor.sandbox.directories.push(data.module);
  effects.vscode.sandboxFsSync.mkdir(state.editor.modulesByPath, data.module);
});

export const onDirectoryUpdated: Operator<LiveMessage<{
  directoryShortid: string;
  module: Directory; // Still very weird
}>> = mutate(({ state, actions, effects }, { _isOwnMessage, data }) => {
  const sandbox = state.editor.sandbox;
  if (_isOwnMessage || !sandbox) {
    return;
  }

  const directoryIndex = sandbox.directories.findIndex(
    directoryEntry => directoryEntry.shortid === data.directoryShortid
  );
  const existingDirectory = sandbox.directories[directoryIndex];
  const hasChangedPath = existingDirectory.path !== data.module.path;

  Object.assign(existingDirectory, data.module);

  if (hasChangedPath && sandbox.currentModule) {
    const prevCurrentModulePath = sandbox.currentModule.path;

    state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
      sandbox.get()
    );
    actions.editor.internal.updatePreviewCode();

    if (prevCurrentModulePath !== sandbox.currentModule.path) {
      actions.editor.internal.setCurrentModule(sandbox.currentModule);
    }
  }
});

export const onDirectoryDeleted: Operator<LiveMessage<{
  directoryShortid: string;
}>> = mutate(({ state, effects, actions }, { _isOwnMessage, data }) => {
  const sandbox = state.editor.sandbox;
  if (_isOwnMessage || !sandbox) {
    return;
  }

  const directory = sandbox.directories.find(
    directoryItem => directoryItem.shortid === data.directoryShortid
  );

  if (!directory) {
    return;
  }

  const removedDirectory = sandbox.directories.splice(
    sandbox.directories.indexOf(directory),
    1
  )[0];
  const {
    removedModules,
    removedDirectories,
  } = getModulesAndDirectoriesInDirectory(
    removedDirectory,
    sandbox.modules,
    sandbox.directories
  );

  removedModules.forEach(removedModule => {
    effects.vscode.sandboxFsSync.unlink(
      state.editor.modulesByPath,
      removedModule
    );
    sandbox.modules.splice(sandbox.modules.indexOf(removedModule), 1);
  });

  removedDirectories.forEach(removedDirectoryItem => {
    sandbox.directories.splice(
      sandbox.directories.indexOf(removedDirectoryItem),
      1
    );
  });

  // We open the main module as we do not really know if you had opened
  // any nested file of this directory. It would require complex logic
  // to figure that out. This concept is soon removed anyways
  if (state.editor.sandbox.mainModule)
    effects.vscode.openModule(state.editor.sandbox.mainModule);
  actions.editor.internal.updatePreviewCode();
});

export const onUserSelection: Operator<LiveMessage<{
  liveUserId: string;
  moduleShortid: string;
  selection: UserSelection;
}>> = mutate(({ state, effects }, { _isOwnMessage, data }) => {
  if (_isOwnMessage || !state.live.roomInfo || !state.editor.sandbox) {
    return;
  }

  const userSelectionLiveUserId = data.liveUserId;
  const { moduleShortid } = data;
  const { selection } = data;
  const userIndex = state.live.roomInfo.users.findIndex(
    u => u.id === userSelectionLiveUserId
  );

  if (userIndex > -1) {
    state.live.roomInfo.users[userIndex].currentModuleShortid = moduleShortid;
    state.live.roomInfo.users[userIndex].selection = selection;
  }

  const module = state.editor.sandbox.modules.find(
    m => m.shortid === moduleShortid
  );
  if (module && state.live.isEditor(userSelectionLiveUserId)) {
    const user = state.live.roomInfo.users.find(
      u => u.id === userSelectionLiveUserId
    );

    if (user) {
      effects.vscode.updateUserSelections(module, [
        {
          userId: userSelectionLiveUserId,
          name: user.username,
          selection,
          color: json(user.color),
        },
      ]);
    }
  }
});

export const onUserCurrentModule: Operator<LiveMessage<{
  live_user_id: string;
  moduleShortid: string;
}>> = mutate(({ state, actions }, { _isOwnMessage, data }) => {
  if (_isOwnMessage || !state.live.roomInfo || !state.editor.sandbox) {
    return;
  }
  const userIndex = state.live.roomInfo.users.findIndex(
    u => u.id === data.live_user_id
  );

  if (userIndex > -1) {
    state.live.roomInfo.users[userIndex].currentModuleShortid =
      data.moduleShortid;
  }

  actions.live.internal.clearUserSelections(data.live_user_id);

  if (
    state.live.followingUserId === data.live_user_id &&
    data.moduleShortid !== state.editor.sandbox.currentModule?.shortid
  ) {
    const { moduleShortid } = data;
    const { modules } = state.editor.sandbox;
    const module = modules.find(m => m.shortid === moduleShortid);

    if (!module) {
      return;
    }

    actions.editor.moduleSelected({
      id: module.id,
    });
  }
});

export const onLiveMode: Operator<LiveMessage<{
  mode: string;
}>> = mutate(({ state, actions }, { _isOwnMessage, data }) => {
  if (!state.live.roomInfo) {
    return;
  }

  if (!_isOwnMessage) {
    state.live.roomInfo.mode = data.mode;
  }
  actions.live.internal.clearUserSelections(null);
});

export const onLiveChatEnabled: Operator<LiveMessage<{
  enabled: boolean;
}>> = mutate(({ state }, { _isOwnMessage, data }) => {
  if (!state.live.roomInfo) {
    return;
  }

  if (_isOwnMessage) {
    return;
  }
  state.live.roomInfo.chatEnabled = data.enabled;
});

export const onLiveAddEditor: Operator<LiveMessage<{
  editor_user_id: string;
}>> = mutate(({ state }, { _isOwnMessage, data }) => {
  if (!state.live.roomInfo) {
    return;
  }

  if (!_isOwnMessage) {
    state.live.roomInfo.editorIds.push(data.editor_user_id);
  }
});

export const onLiveRemoveEditor: Operator<LiveMessage<{
  editor_user_id: string;
}>> = mutate(({ state }, { _isOwnMessage, data }) => {
  if (!state.live.roomInfo) {
    return;
  }

  if (!_isOwnMessage) {
    const userId = data.editor_user_id;

    const editors = state.live.roomInfo.editorIds;
    const newEditors = editors.filter(id => id !== userId);

    state.live.roomInfo.editorIds = newEditors;
  }
});

export const onOperation: Operator<LiveMessage<{
  module_shortid: string;
  operation: any;
}>> = mutate(({ state, effects }, { _isOwnMessage, data }) => {
  if (state.live.isLoading) {
    return;
  }
  if (_isOwnMessage) {
    // Do nothing since we already sent this operation
  } else {
    try {
      effects.live.applyServer(data.module_shortid, data.operation);
    } catch (e) {
      // Something went wrong, probably a sync mismatch. Request new version
      console.error('Something went wrong with applying OT operation');

      logError(e);

      effects.live.sendModuleStateSyncRequest();
    }
  }
});

export const onConnectionLoss: Operator<LiveMessage> = mutate(
  async ({ state, effects }) => {
    if (!state.live.reconnecting) {
      let notificationId: string | null = null;
      const timeout = setTimeout(() => {
        notificationId = effects.notificationToast.add({
          message: 'We lost connection with the live server, reconnecting...',
          status: NotificationStatus.ERROR,
        });
      }, 2000);

      state.live.reconnecting = true;

      await effects.flows.waitUntil(s => s.live.reconnecting === false);
      if (notificationId) {
        effects.notificationToast.remove(notificationId);
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
);

export const onDisconnect: Operator<LiveMessage<{
  reason: LiveDisconnectReason;
}>> = mutate(({ state, actions }, { data }) => {
  actions.live.internal.disconnect();

  if (state.editor.sandbox) state.editor.sandbox.setOwned(state.live.isOwner);

  actions.modalOpened({
    modal: 'liveSessionEnded',
    message:
      data.reason === 'close'
        ? 'The owner ended the session'
        : 'The session has ended due to inactivity',
  });

  actions.live.internal.reset();
});

export const onOwnerLeft: Operator<LiveMessage> = mutate(({ actions }) => {
  actions.modalOpened({
    modal: 'liveSessionEnded',
    message: 'The owner left the session',
  });
});

export const onChat: Operator<LiveMessage<{
  live_user_id: string;
  message: string;
  date: number;
}>> = mutate(({ state }, { data }) => {
  if (!state.live.roomInfo) {
    return;
  }

  let name = state.live.roomInfo.chat.users[data.live_user_id];

  if (!name) {
    const user = state.live.roomInfo.users.find(
      u => u.id === data.live_user_id
    );

    if (user) {
      state.live.roomInfo.chat.users[data.live_user_id] = user.username;
      name = user.username;
    } else {
      name = 'Unknown User';
    }
  }

  state.live.roomInfo.chat.messages.push({
    userId: data.live_user_id,
    message: data.message,
    date: data.date,
  });
});

export const onNotification: Operator<LiveMessage<{
  message: string;
  type: NotificationStatus;
}>> = mutate(({ effects }, { data }) => {
  effects.notificationToast.add({
    message: data.message,
    status: data.type,
  });
});
