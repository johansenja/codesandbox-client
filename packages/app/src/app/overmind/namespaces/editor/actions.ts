import {
  EnvironmentVariable,
  ModuleCorrection,
  ModuleError,
  ModuleTab,
  WindowOrientation,
} from '@codesandbox/common/lib/types';
import { getTextOperation } from '@codesandbox/common/lib/utils/diff';
import { convertTypeToStatus } from '@codesandbox/common/lib/utils/notifications';
import { NotificationStatus } from '@codesandbox/notifications';
import { Action, AsyncAction } from 'app/overmind';
import { withLoadApp, withOwnedSandbox } from 'app/overmind/factories';
import {
  addDevToolsTab as addDevToolsTabUtil,
  closeDevToolsTab as closeDevToolsTabUtil,
  moveDevToolsTab as moveDevToolsTabUtil,
} from 'app/pages/Sandbox/Editor/Content/utils';
import { clearCorrectionsFromAction } from 'app/utils/corrections';
import { json } from 'overmind';

import eventToTransform from '../../utils/event-to-transform';
import { SERVER } from '../../utils/items';
import * as internalActions from './internalActions';

export const internal = internalActions;

export const onNavigateAway: Action = () => {};

export const addNpmDependency: AsyncAction<{
  name: string;
  version?: string;
  isDev?: boolean;
}> = withOwnedSandbox(
  async ({ actions, effects, state }, { name, version, isDev }) => {
    effects.analytics.track('Add NPM Dependency');
    state.currentModal = null;
    let newVersion = version;

    if (!newVersion) {
      const dependency = await effects.api.getDependency(name);
      newVersion = dependency.version;
    }

    await actions.editor.internal.addNpmDependencyToPackageJson({
      name,
      version: newVersion,
      isDev: Boolean(isDev),
    });

    effects.preview.executeCodeImmediately();
  }
);

export const npmDependencyRemoved: AsyncAction<string> = withOwnedSandbox(
  async ({ actions, effects }, name) => {
    effects.analytics.track('Remove NPM Dependency');

    await actions.editor.internal.removeNpmDependencyFromPackageJson(name);

    effects.preview.executeCodeImmediately();
  }
);

export const sandboxChanged: AsyncAction<{ id: string }> = withLoadApp<{
  id: string;
}>(async ({ state, actions, effects }, { id }) => {
  // This happens when we fork. This can be avoided with state first routing
  if (state.editor.isForkingSandbox && state.editor.sandbox) {
    effects.vscode.openModule(state.editor.sandbox.currentModule);

    await actions.editor.internal.initializeLiveSandbox();

    state.editor.isForkingSandbox = false;
    return;
  }

  await effects.vscode.closeAllTabs();

  state.editor.error = null;

  effects.browser.storage.set('currentSandboxId', id);

  const hasExistingSandbox = Boolean(state.editor.sandbox.id);

  if (state.live.isLive) {
    actions.live.internal.disconnect();
  }

  state.editor.isLoading = !hasExistingSandbox;
  state.editor.notFound = false;

  try {
    const sandbox = await effects.api.getSandbox(id);

    actions.internal.setCurrentSandbox(sandbox);
    actions.workspace.openDefaultItem();
  } catch (error) {
    state.editor.notFound = true;
    let detail = error.response?.data?.errors?.detail;
    if (Array.isArray(detail)) {
      detail = detail[0];
    }
    state.editor.error = detail || error.message;
    state.editor.isLoading = false;
    return;
  }

  const sandbox = state.editor.sandbox!;

  await effects.vscode.changeSandbox(sandbox.get(), fs => {
    state.editor.modulesByPath = fs;
  });

  if (sandbox.hasFeature('containerLsp') && !sandbox.owned) {
    effects.vscode.setReadOnly(true);
    effects.notificationToast.add({
      message:
        'This Sandbox is running an experiment. You have to fork it before you can make any changes',
      title: 'Experimental Sandbox',
      status: convertTypeToStatus('notice'),
      sticky: true,
      actions: {
        primary: [
          {
            label: 'Fork',
            run: () => {
              actions.editor.forkSandboxClicked();
            },
          },
        ],
      },
    });
  }

  actions.internal.ensurePackageJSON();

  await actions.editor.internal.initializeLiveSandbox();

  if (sandbox.hasPermission('write_code') && !state.live.isLive) {
    actions.files.internal.recoverFiles();
  } else if (state.live.isLive) {
    await effects.live.sendModuleStateSyncRequest();
  }

  effects.vscode.openModule(sandbox.currentModule);
  effects.preview.executeCodeImmediately({ initialRender: true });

  state.editor.isLoading = false;
});

export const contentMounted: Action = ({ state, effects }) => {
  effects.browser.onUnload(event => {
    if (
      !state.editor.sandbox.isAllModulesSynced &&
      !state.editor.isForkingSandbox
    ) {
      const returnMessage =
        'You have not saved all your modules, are you sure you want to close this tab?';

      event.returnValue = returnMessage; // eslint-disable-line

      return returnMessage;
    }

    return null;
  });
};

export const resizingStarted: Action = ({ state }) => {
  state.editor.isResizing = true;
};

export const resizingStopped: Action = ({ state }) => {
  state.editor.isResizing = false;
};

export const codeSaved: AsyncAction<{
  code: string;
  moduleShortid: string;
  cbID: string | null;
}> = withOwnedSandbox(
  async ({ actions }, { code, moduleShortid, cbID }) => {
    actions.editor.internal.saveCode({
      code,
      moduleShortid,
      cbID,
    });
  },
  async ({ effects }, { cbID }) => {
    if (cbID) {
      effects.vscode.callCallbackError(cbID);
    }
  },
  'write_code'
);

export const onOperationApplied: Action<{
  moduleShortid: string;
  code: string;
}> = ({ state, effects, actions }, { code, moduleShortid }) => {
  if (!state.editor.sandbox) {
    return;
  }

  const module = state.editor.sandbox.getModule(moduleShortid);

  if (!module) {
    return;
  }

  actions.editor.internal.setModuleCode({
    module,
    code,
  });

  actions.editor.internal.updatePreviewCode();

  if (module.savedCode !== null && module.code === module.savedCode) {
    effects.vscode.revertModule(module);
  }
};

export const codeChanged: Action<{
  moduleShortid: string;
  code: string;
  event?: any;
}> = ({ effects, state, actions }, { code, event, moduleShortid }) => {
  effects.analytics.trackOnce('Change Code');

  if (!state.editor.sandbox) {
    return;
  }

  const module = state.editor.sandbox.getModule(moduleShortid);

  if (!module) {
    return;
  }

  if (state.live.isLive) {
    const operation = event
      ? eventToTransform(event, module.code).operation
      : getTextOperation(module.code, code);

    effects.live.sendCodeUpdate(moduleShortid, operation);
  }

  actions.editor.internal.setModuleCode({
    module,
    code,
  });

  if (
    !state.editor.sandbox.templateDefinition.isServer &&
    state.preferences.settings.livePreviewEnabled
  ) {
    actions.editor.internal.updatePreviewCode();
  }

  if (module.savedCode !== null && module.code === module.savedCode) {
    effects.vscode.revertModule(module);
  }
};

export const saveClicked: AsyncAction = withOwnedSandbox(
  async ({ state, effects, actions }) => {
    const sandbox = state.editor.sandbox;

    if (!sandbox) {
      return;
    }

    try {
      const changedModules = sandbox.changedModules;

      const updatedModules = await effects.api.saveModules(
        sandbox.id,
        changedModules
      );

      updatedModules.forEach(updatedModule => {
        const module = sandbox.getModule(updatedModule.shortid);

        if (module) {
          module.insertedAt = updatedModule.insertedAt;
          module.updatedAt = updatedModule.updatedAt;

          module.savedCode =
            updatedModule.code === module.code ? null : updatedModule.code;

          effects.vscode.sandboxFsSync.writeFile(
            state.editor.modulesByPath,
            module
          );
          effects.moduleRecover.remove(sandbox.id, module);
        } else {
          // We might not have the module, as it was created by the server. In
          // this case we put it in. There is an edge case here where the user
          // might delete the module while it is being updated, but it will very
          // likely not happen
          sandbox.addModule(updatedModule);
        }
      });

      if (
        sandbox.originalGit &&
        state.workspace.openedWorkspaceItem === 'github'
      ) {
        actions.git.internal.fetchGitChanges();
      }

      effects.preview.executeCodeImmediately();
    } catch (error) {
      actions.internal.handleError({
        message: 'There was a problem with saving the files, please try again',
        error,
      });
    }
  }
);

export const createZipClicked: Action = ({ state, effects }) => {
  if (!state.editor.sandbox) {
    return;
  }
  effects.zip.download(state.editor.sandbox.get());
};

export const forkExternalSandbox: AsyncAction<{
  sandboxId: string;
  openInNewWindow?: boolean;
  body?: { collectionId: string };
}> = async ({ effects, state }, { sandboxId, openInNewWindow, body }) => {
  effects.analytics.track('Fork Sandbox', { type: 'external' });

  const forkedSandbox = await effects.api.forkSandbox(sandboxId, body);

  // state.editor.sandboxes[forkedSandbox.id] = forkedSandbox;
  state.editor.sandbox.set(forkedSandbox);
  effects.router.updateSandboxUrl(forkedSandbox, { openInNewWindow });
};

export const forkSandboxClicked: AsyncAction = async ({
  state,
  effects,
  actions,
}) => {
  if (!state.editor.sandbox) {
    return;
  }

  if (
    state.editor.sandbox.owned &&
    !state.editor.sandbox.customTemplate &&
    !effects.browser.confirm('Do you want to fork your own sandbox?')
  ) {
    return;
  }

  await actions.editor.internal.forkSandbox({
    sandboxId: state.editor.sandbox.id,
  });
};

export const likeSandboxToggled: AsyncAction = async ({ state, effects }) => {
  const wasLiked = state.editor.sandbox.userLiked;
  const sandbox = state.editor.sandbox;
  sandbox.toggleLiked();
  if (wasLiked) {
    await effects.api.unlikeSandbox(sandbox.id);
  } else {
    await effects.api.likeSandbox(sandbox.id);
  }
};

export const moduleSelected: Action<
  | {
      // Id means it is coming from Explorer
      id: string;
      path?: undefined;
    }
  | {
      // Path means it is coming from VSCode
      id?: undefined;
      path: string;
    }
> = ({ actions, effects, state }, { id, path }) => {
  effects.analytics.track('Open File');

  const sandbox = state.editor.sandbox;

  if (!sandbox) {
    return;
  }

  try {
    const module = path
      ? sandbox.getModuleByPath(path)
      : sandbox.getModuleById(id);

    if (sandbox.isCurrentModule(module)) {
      return;
    }

    actions.editor.internal.setCurrentModule(module);

    if (state.live.isLive && state.live.liveUser && state.live.roomInfo) {
      effects.vscode.updateUserSelections(
        module,
        actions.live.internal.getSelectionsForModule(module)
      );
      state.live.liveUser.currentModuleShortid = module.shortid;

      if (state.live.followingUserId) {
        const followingUser = state.live.roomInfo.users.find(
          u => u.id === state.live.followingUserId
        );

        if (
          followingUser &&
          followingUser.currentModuleShortid !== module.shortid
        ) {
          // Reset following as this is a user change module action
          state.live.followingUserId = null;
        }
      }

      effects.live.sendUserCurrentModule(module.shortid);

      if (!state.editor.isInProjectView) {
        actions.editor.internal.updatePreviewCode();
      }
    }
  } catch (error) {
    // You jumped to a file not in the Sandbox, for example typings
    state.editor.sandbox.unsetCurrentModule();
  }
};

export const clearModuleSelected: Action = ({ state }) => {
  state.editor.sandbox.unsetCurrentModule();
};

export const moduleDoubleClicked: Action = ({ state, effects }) => {
  effects.vscode.runCommand('workbench.action.keepEditor');

  const tabs = state.editor.tabs as ModuleTab[];
  const tab = tabs.find(
    tabItem =>
      tabItem.moduleShortid === state.editor.sandbox.currentModule.shortid
  );

  if (tab) {
    tab.dirty = false;
  }
};

export const tabClosed: Action<number> = ({ state, actions }, tabIndex) => {
  if (state.editor.tabs.length > 1) {
    actions.internal.closeTabByIndex(tabIndex);
  }
};

export const tabMoved: Action<{
  prevIndex: number;
  nextIndex: number;
}> = ({ state }, { prevIndex, nextIndex }) => {
  const { tabs } = state.editor;
  const tab = json(tabs[prevIndex]);

  state.editor.tabs.splice(prevIndex, 1);
  state.editor.tabs.splice(nextIndex, 0, tab);
};

export const prettifyClicked: AsyncAction = async ({
  state,
  effects,
  actions,
}) => {
  effects.analytics.track('Prettify Code');
  const module = state.editor.sandbox.currentModule;
  if (!module.id) {
    return;
  }
  const newCode = await effects.prettyfier.prettify(
    module.id,
    module.title,
    module.code || ''
  );

  actions.editor.codeChanged({
    code: newCode,
    moduleShortid: module.shortid,
  });
};

export const errorsCleared: Action = ({ state, effects }) => {
  const sandbox = state.editor.sandbox;
  if (!sandbox) {
    return;
  }

  if (sandbox.errors.length) {
    sandbox.errors.forEach(error => {
      try {
        const module = sandbox.getModuleByPath(error.path);
        module.errors = [];
      } catch (e) {
        // Module is probably somewhere in eg. /node_modules which is not
        // in the store
      }
    });
    sandbox.clearErrors();
  }
};

export const toggleStatusBar: Action = ({ state }) => {
  state.editor.statusBar = !state.editor.statusBar;
};

export const projectViewToggled: Action = ({ state, actions }) => {
  state.editor.isInProjectView = !state.editor.isInProjectView;
  actions.editor.internal.updatePreviewCode();
};

export const frozenUpdated: AsyncAction<{ frozen: boolean }> = async (
  { state, effects },
  { frozen }
) => {
  state.editor.sandbox.setFrozen(frozen);

  await effects.api.saveFrozen(state.editor.sandbox.id, frozen);
};

export const quickActionsOpened: Action = ({ state }) => {
  state.editor.quickActionsOpen = true;
};

export const quickActionsClosed: Action = ({ state }) => {
  state.editor.quickActionsOpen = false;
};

export const setPreviewContent: Action = () => {};

export const togglePreviewContent: Action = ({ state, effects }) => {
  state.editor.previewWindowVisible = !state.editor.previewWindowVisible;
  effects.vscode.resetLayout();
};

export const currentTabChanged: Action<{
  tabId: string;
}> = ({ state }, { tabId }) => {
  state.editor.currentTabId = tabId;
};

export const discardModuleChanges: Action<{
  moduleShortid: string;
}> = ({ state, effects, actions }, { moduleShortid }) => {
  effects.analytics.track('Code Discarded');

  const sandbox = state.editor.sandbox;
  if (!sandbox) {
    return;
  }

  const module = sandbox.getModule(moduleShortid);

  if (!module) {
    return;
  }

  module.updatedAt = new Date().toString();
  effects.vscode.revertModule(module);
};

export const fetchEnvironmentVariables: AsyncAction = async ({
  state,
  effects,
}) => {
  state.editor.sandbox.setEnvironmentVariables(
    await effects.api.getEnvironmentVariables(state.editor.sandbox.id)
  );
};

export const updateEnvironmentVariables: AsyncAction<EnvironmentVariable> = async (
  { effects, state },
  environmentVariable
) => {
  state.editor.sandbox.setEnvironmentVariables(
    await effects.api.saveEnvironmentVariable(
      state.editor.sandbox.id,
      environmentVariable
    )
  );

  effects.codesandboxApi.restartSandbox();
};

export const deleteEnvironmentVariable: AsyncAction<{
  name: string;
}> = async ({ state, effects }, { name }) => {
  state.editor.sandbox.setEnvironmentVariables(
    await effects.api.deleteEnvironmentVariable(state.editor.sandbox.id, name)
  );
  effects.codesandboxApi.restartSandbox();
};

/**
 * This will let the user know on fork that some secrets need to be set if there are any empty ones
 */
export const showEnvironmentVariablesNotification: AsyncAction = async ({
  state,
  actions,
  effects,
}) => {
  const sandbox = state.editor.sandbox;

  await actions.editor.fetchEnvironmentVariables();

  const environmentVariables = sandbox.environmentVariables;
  const emptyVarCount = Object.keys(environmentVariables).filter(
    key => !environmentVariables[key]
  ).length;
  if (emptyVarCount > 0) {
    effects.notificationToast.add({
      status: NotificationStatus.NOTICE,
      title: 'Unset Secrets',
      message: `This sandbox has ${emptyVarCount} secrets that need to be set. You can set them in the server tab.`,
      actions: {
        primary: [
          {
            label: 'Open Server Tab',
            run: () => {
              actions.workspace.setWorkspaceItem({ item: SERVER.id });
            },
          },
        ],
      },
    });
  }
};

export const toggleEditorPreviewLayout: Action = ({ state, effects }) => {
  const currentOrientation = state.editor.previewWindowOrientation;

  state.editor.previewWindowOrientation =
    currentOrientation === WindowOrientation.VERTICAL
      ? WindowOrientation.HORIZONTAL
      : WindowOrientation.VERTICAL;

  effects.vscode.resetLayout();
};

export const previewActionReceived: Action<any> = (
  { actions, effects, state },
  action
) => {
  switch (action.action) {
    case 'notification':
      effects.notificationToast.add({
        message: action.title,
        status: action.notificationType,
        timeAlive: action.timeAlive,
      });
      break;
    case 'show-error': {
      if (!state.editor.sandbox) {
        return;
      }
      const error: ModuleError = {
        column: action.column,
        line: action.line,
        columnEnd: action.columnEnd,
        lineEnd: action.lineEnd,
        message: action.message,
        title: action.title,
        path: action.path,
        source: action.source,
        severity: action.severity,
        type: action.type,
      };
      try {
        state.editor.sandbox.addError(error);
        effects.vscode.setErrors(state.editor.sandbox.errors);
      } catch (e) {
        /* ignore, this module can be in a node_modules for example */
      }
      break;
    }
    case 'show-correction': {
      if (!state.editor.sandbox) {
        return;
      }
      const correction: ModuleCorrection = {
        path: action.path,
        column: action.column,
        line: action.line,
        columnEnd: action.columnEnd,
        lineEnd: action.lineEnd,
        message: action.message,
        source: action.source,
        severity: action.severity,
      };
      try {
        state.editor.sandbox.addCorrection(correction);
        effects.vscode.setCorrections(state.editor.sandbox.corrections);
      } catch (e) {
        /* ignore, this module can be in a node_modules for example */
      }
      break;
    }
    case 'clear-errors': {
      const sandbox = state.editor.sandbox;
      const currentErrors = sandbox.errors;
      const newErrors = clearCorrectionsFromAction(currentErrors, action);

      state.editor.sandbox.clearErrors();
      newErrors.forEach(error => sandbox.addError(error));
      effects.vscode.setErrors(sandbox.errors);
      break;
    }
    case 'clear-corrections': {
      const sandbox = state.editor.sandbox;
      const currentCorrections = sandbox.corrections;
      // Uhm, clear corrections here as well?
      const newCorrections = clearCorrectionsFromAction(
        currentCorrections,
        action
      );

      sandbox.clearCorrections();
      newCorrections.forEach(correction => sandbox.addCorrection(correction));
      effects.vscode.setCorrections(sandbox.corrections);
      break;
    }
    case 'source.module.rename': {
      const sandbox = state.editor.sandbox;
      const module = sandbox.getModuleByPath(action.path.replace(/^\//, ''));

      if (module) {
        module.title = action.title;
      }
      break;
    }
    case 'source.dependencies.add': {
      const name = action.dependency;
      actions.editor.addNpmDependency({
        name,
      });
      break;
    }
  }
};

export const renameModule: AsyncAction<{
  title: string;
  moduleShortid: string;
}> = withOwnedSandbox(
  async ({ state, actions, effects }, { title, moduleShortid }) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const module = sandbox.getModule(moduleShortid);

    if (!module) {
      return;
    }

    const oldTitle = module.title;

    module.title = title;

    try {
      await effects.api.saveModuleTitle(sandbox.id, moduleShortid, title);

      if (state.live.isCurrentEditor) {
        effects.live.sendModuleUpdate(module);
      }
    } catch (error) {
      module.title = oldTitle;

      actions.internal.handleError({ message: 'Could not rename file', error });
    }
  }
);

export const onDevToolsTabAdded: Action<{
  tab: any;
}> = ({ state, actions }, { tab }) => {
  const { devToolTabs } = state.editor;
  const { devTools: newDevToolTabs, position } = addDevToolsTabUtil(
    json(devToolTabs),
    tab
  );

  const code = JSON.stringify({ preview: newDevToolTabs }, null, 2);
  const nextPos = position;

  actions.editor.internal.updateDevtools({
    code,
  });

  state.editor.currentDevToolsPosition = nextPos;
};

export const onDevToolsTabMoved: Action<{
  prevPos: any;
  nextPos: any;
}> = ({ state, actions }, { prevPos, nextPos }) => {
  const { devToolTabs } = state.editor;
  const newDevToolTabs = moveDevToolsTabUtil(
    json(devToolTabs),
    prevPos,
    nextPos
  );
  const code = JSON.stringify({ preview: newDevToolTabs }, null, 2);

  actions.editor.internal.updateDevtools({
    code,
  });

  state.editor.currentDevToolsPosition = nextPos;
};

export const onDevToolsTabClosed: Action<{
  pos: any;
}> = ({ state, actions }, { pos }) => {
  const { devToolTabs } = state.editor;
  const closePos = pos;
  const newDevToolTabs = closeDevToolsTabUtil(json(devToolTabs), closePos);
  const code = JSON.stringify({ preview: newDevToolTabs }, null, 2);

  actions.editor.internal.updateDevtools({
    code,
  });
};

export const onDevToolsPositionChanged: Action<{
  position: any;
}> = ({ state }, { position }) => {
  state.editor.currentDevToolsPosition = position;
};

export const openDevtoolsTab: Action<{
  tab: any;
}> = ({ state, actions }, { tab: tabToFind }) => {
  const serializedTab = JSON.stringify(tabToFind);
  const { devToolTabs } = state.editor;
  let nextPos;

  for (let i = 0; i < devToolTabs.length; i++) {
    const view = devToolTabs[i];

    for (let j = 0; j < view.views.length; j++) {
      const tab = view.views[j];
      if (JSON.stringify(tab) === serializedTab) {
        nextPos = {
          devToolIndex: i,
          tabPosition: j,
        };
      }
    }
  }

  if (nextPos) {
    state.editor.currentDevToolsPosition = nextPos;
  } else {
    actions.editor.onDevToolsTabAdded({
      tab: tabToFind,
    });
  }
};

export const sessionFreezeOverride: Action<{ frozen: boolean }> = (
  { state },
  { frozen }
) => {
  state.editor.sessionFrozen = frozen;
};
