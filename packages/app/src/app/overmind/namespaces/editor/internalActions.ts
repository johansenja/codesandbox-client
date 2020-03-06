import getTemplateDefinition, {
  TemplateType,
} from '@codesandbox/common/lib/templates';
import {
  Module,
  ModuleTab,
  ServerContainerStatus,
  TabType,
} from '@codesandbox/common/lib/types';
import {
  captureException,
  logBreadcrumb,
} from '@codesandbox/common/lib/utils/analytics/sentry';
import slugify from '@codesandbox/common/lib/utils/slugify';
import { Action, AsyncAction } from 'app/overmind';
import { sortObjectByKeys } from 'app/overmind/utils/common';
import { getTemplate as computeTemplate } from 'codesandbox-import-utils/lib/create-sandbox/templates';
import { mapValues } from 'lodash-es';

export const initializeSandbox: AsyncAction = async ({
  state,
  actions,
  effects,
}) => {
  await Promise.all([
    actions.editor.internal
      .initializeLiveSandbox()
      .then(() => effects.live.sendModuleStateSyncRequest()),
    actions.editor.loadCollaborators({ sandboxId: state.editor.sandbox.id }),
    actions.editor.listenToSandboxChanges(),
  ]);
};

export const initializeLiveSandbox: AsyncAction = async ({
  state,
  actions,
}) => {
  const sandbox = state.editor.sandbox;
  state.live.isTeam = Boolean(sandbox.team);

  if (state.live.isLive && state.live.roomInfo) {
    const roomChanged = state.live.roomInfo.roomId !== sandbox.roomId;

    if (!roomChanged) {
      // In this case we don't need to initialize new live session, we reuse the existing one
      return;
    }

    await actions.live.internal.disconnect();
  }

  if (sandbox.roomId) {
    await actions.live.internal.initialize(sandbox.roomId);
  }
};

export const setModuleSavedCode: Action<{
  moduleShortid: string;
  savedCode: string | null;
}> = ({ state }, { moduleShortid, savedCode }) => {
  const sandbox = state.editor.sandbox;

  const module = sandbox.getModule(moduleShortid);

  if (module) {
    if (savedCode === undefined) {
      logBreadcrumb({
        type: 'error',
        message: `SETTING UNDEFINED SAVEDCODE FOR CODE: ${module.code}`,
      });
      captureException(new Error('SETTING UNDEFINED SAVEDCODE'));
    }

    module.savedCode = module.code === savedCode ? null : savedCode;
  }
};

export const saveCode: AsyncAction<{
  code: string;
  moduleShortid: string;
  cbID?: string | null;
}> = async ({ state, effects, actions }, { code, moduleShortid, cbID }) => {
  effects.analytics.track('Save Code');

  const sandbox = state.editor.sandbox;

  if (!sandbox) {
    return;
  }

  const module = sandbox.getModule(moduleShortid);

  if (!module) {
    return;
  }

  if (module.code !== code) {
    actions.editor.codeChanged({ moduleShortid, code });
  }

  try {
    const updatedModule = await effects.api.saveModuleCode(sandbox.id, module);

    module.insertedAt = updatedModule.insertedAt;
    module.updatedAt = updatedModule.updatedAt;

    const savedCode =
      updatedModule.code === module.code ? null : updatedModule.code;
    if (savedCode === undefined) {
      logBreadcrumb({
        type: 'error',
        message: `SETTING UNDEFINED SAVEDCODE FOR CODE: ${updatedModule.code}`,
      });
      captureException(new Error('SETTING UNDEFINED SAVEDCODE'));
    }

    module.savedCode = savedCode;

    effects.vscode.sandboxFsSync.writeFile(state.editor.modulesByPath, module);
    effects.moduleRecover.remove(sandbox.id, module);

    if (cbID) {
      effects.vscode.callCallback(cbID);
    }

    if (
      sandbox.originalGit &&
      state.workspace.openedWorkspaceItem === 'github'
    ) {
      state.git.isFetching = true;
      state.git.originalGitChanges = await effects.api.getGitChanges(
        sandbox.id
      );
      state.git.isFetching = false;
    }

    // If the executor is a server we only should send updates if the sandbox has been
    // started already
    if (
      !effects.executor.isServer() ||
      state.server.containerStatus === ServerContainerStatus.SANDBOX_STARTED
    ) {
      effects.executor.updateFiles(sandbox.get());
    }

    if (state.live.isLive && state.live.isCurrentEditor) {
      effects.live.sendModuleSaved(module);
    }

    await actions.editor.internal.updateCurrentTemplate();

    effects.vscode.runCommand('workbench.action.keepEditor');

    const tabs = state.editor.tabs as ModuleTab[];
    const tab = tabs.find(
      tabItem => tabItem.moduleShortid === updatedModule.shortid
    );

    if (tab) {
      tab.dirty = false;
    }
  } catch (error) {
    actions.internal.handleError({
      message: 'There was a problem with saving the code, please try again',
      error,
    });

    if (cbID) {
      effects.vscode.callCallbackError(cbID, error.message);
    }
  }
};

export const updateCurrentTemplate: AsyncAction = async ({
  effects,
  state,
}) => {
  try {
    const template = state.editor.sandbox.templateDefinition;
    const parsedConfigurations = state.editor.sandbox.parsedConfigurations;
    // We always want to be able to update server template based on its detection.
    // We only want to update the client template when it's explicitly specified
    // in the sandbox configuration.
    if (
      (template && template.isServer) ||
      parsedConfigurations.sandbox?.parsed?.template
    ) {
      const { parsed = {} } = parsedConfigurations?.package || {};

      const modulesByPath = mapValues(state.editor.modulesByPath, module => ({
        // No idea why this typing fails!
        // @ts-ignore
        content: module.code || '',
        // @ts-ignore
        isBinary: module.isBinary,
      }));

      // TODO: What is a template really? Two different kinds of templates here, need to fix the types
      // Talk to Ives and Bogdan
      const newTemplate = (computeTemplate(parsed, modulesByPath) ||
        'node') as TemplateType;

      if (
        template &&
        newTemplate !== template.name &&
        template.isServer === getTemplateDefinition(newTemplate).isServer
      ) {
        state.editor.sandbox.setTemplate(newTemplate);
        await effects.api.saveTemplate(state.editor.sandbox.id, newTemplate);
      }
    }
  } catch (e) {
    // We don't want this to be blocking at all, it's low prio
    if (process.env.NODE_ENV === 'development') {
      console.error(e);
    }
  }
};

export const removeNpmDependencyFromPackageJson: AsyncAction<string> = async (
  { state, actions },
  name
) => {
  if (
    !state.editor.sandbox.packageJsonCode ||
    !state.editor.sandbox.packageJson
  ) {
    return;
  }

  const packageJson = JSON.parse(state.editor.sandbox.packageJsonCode);

  delete packageJson.dependencies[name];

  await actions.editor.codeSaved({
    code: JSON.stringify(packageJson, null, 2),
    moduleShortid: state.editor.sandbox.packageJson.shortid,
    cbID: null,
  });
};

export const addNpmDependencyToPackageJson: AsyncAction<{
  name: string;
  version?: string;
  isDev: boolean;
}> = async ({ state, actions }, { name, isDev, version }) => {
  if (
    !state.editor.sandbox.packageJsonCode ||
    !state.editor.sandbox.packageJson
  ) {
    return;
  }

  const packageJson = JSON.parse(state.editor.sandbox.packageJsonCode);

  const type = isDev ? 'devDependencies' : 'dependencies';

  packageJson[type] = packageJson[type] || {};
  packageJson[type][name] = version || 'latest';
  packageJson[type] = sortObjectByKeys(packageJson[type]);

  await actions.editor.codeSaved({
    code: JSON.stringify(packageJson, null, 2),
    moduleShortid: state.editor.sandbox.packageJson.shortid,
    cbID: null,
  });
};

export const setModuleCode: Action<{
  module: Module;
  code: string;
}> = ({ state, effects }, { module, code }) => {
  const { sandbox: currentSandbox } = state.editor;

  if (!currentSandbox) {
    return;
  }

  if (module.savedCode === null) {
    module.savedCode = module.code;
  }

  effects.vscode.runCommand('workbench.action.keepEditor');

  const tabs = state.editor.tabs as ModuleTab[];
  const tab = tabs.find(tabItem => tabItem.moduleShortid === module.shortid);

  if (tab) {
    tab.dirty = false;
  }

  // Save the code to localStorage so we can recover in case of a crash
  effects.moduleRecover.save(
    currentSandbox.id,
    currentSandbox.version,
    module,
    code,
    module.savedCode
  );

  module.code = code;
};

export const forkSandbox: AsyncAction<{
  sandboxId: string;
  body?: { collectionId: string | undefined };
  openInNewWindow?: boolean;
}> = async (
  { state, effects, actions },
  { sandboxId: id, body, openInNewWindow = false }
) => {
  const sandbox = state.editor.sandbox;
  const template = sandbox.templateDefinition;

  if (!state.isLoggedIn && template?.isServer) {
    effects.analytics.track('Show Server Fork Sign In Modal');
    actions.modalOpened({ modal: 'forkServerModal' });

    return;
  }

  effects.analytics.track('Fork Sandbox');

  try {
    state.editor.isForkingSandbox = true;

    const forkedSandbox = await effects.api.forkSandbox(id, body);

    // Copy over any unsaved code
    Object.assign(forkedSandbox, {
      modules: forkedSandbox.modules.map(module => {
        const foundEquivalentModule = sandbox.getModule(module.shortid);

        if (!foundEquivalentModule) {
          return module;
        }

        return {
          ...module,
          code: foundEquivalentModule.code,
        };
      }),
    });

    state.workspace.project.title = forkedSandbox.title || '';
    state.workspace.project.description = forkedSandbox.description || '';
    state.workspace.project.alias = forkedSandbox.alias || '';

    state.editor.sandbox.set(forkedSandbox);
    state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
      forkedSandbox
    );
    effects.preview.updateAddressbarUrl();

    if (template && template.isServer) {
      effects.preview.refresh();
      actions.server.startContainer(forkedSandbox);
    }

    if (state.workspace.openedWorkspaceItem === 'project-summary') {
      actions.workspace.openDefaultItem();
    }

    effects.notificationToast.success('Forked sandbox!');

    if (template && template.isServer) {
      actions.editor.showEnvironmentVariablesNotification();
    }

    effects.router.updateSandboxUrl(forkedSandbox, { openInNewWindow });
  } catch (error) {
    console.error(error);
    actions.internal.handleError({
      message: 'We were unable to fork the sandbox',
      error,
    });

    state.editor.isForkingSandbox = false;
    throw error;
  }
};

export const setCurrentModule: AsyncAction<Module> = async (
  { state, effects },
  module
) => {
  state.editor.currentTabId = null;

  const tabs = state.editor.tabs as ModuleTab[];
  const tab = tabs.find(tabItem => tabItem.moduleShortid === module.shortid);

  if (!tab) {
    const dirtyTabIndex = tabs.findIndex(tabItem => tabItem.dirty);
    const newTab: ModuleTab = {
      type: TabType.MODULE,
      moduleShortid: module.shortid,
      dirty: true,
    };

    if (dirtyTabIndex >= 0) {
      state.editor.tabs.splice(dirtyTabIndex, 1, newTab);
    } else {
      state.editor.tabs.splice(0, 0, newTab);
    }
  }

  state.editor.sandbox.setCurrentModule(module);
  await effects.vscode.openModule(module);
  effects.vscode.setErrors(state.editor.sandbox.errors);
  effects.vscode.setCorrections(state.editor.sandbox.corrections);
};

export const updateSandboxPackageJson: AsyncAction = async ({
  state,
  actions,
}) => {
  const sandbox = state.editor.sandbox;

  if (!sandbox.parsedConfigurations.package?.parsed || !sandbox.packageJson) {
    return;
  }

  if (!sandbox.hasPermission('write_code')) {
    return;
  }

  const { parsed } = sandbox.parsedConfigurations.package;

  parsed.keywords = sandbox.tags;
  parsed.name = slugify(sandbox.title || sandbox.id);
  parsed.description = sandbox.description;

  const code = JSON.stringify(parsed, null, 2);
  const moduleShortid = state.editor.sandbox.packageJson?.shortid;

  if (!moduleShortid) {
    return;
  }

  await actions.editor.codeSaved({
    code,
    moduleShortid,
    cbID: null,
  });
};

export const updateDevtools: AsyncAction<{
  code: string;
}> = async ({ state, actions }, { code }) => {
  if (state.editor.sandbox.owned) {
    const devtoolsModule =
      state.editor.modulesByPath['/.codesandbox/workspace.json'];

    if (devtoolsModule) {
      await actions.editor.codeSaved({
        code,
        moduleShortid: devtoolsModule.shortid,
        cbID: null,
      });
    } else {
      await actions.files.createModulesByPath({
        files: {
          '/.codesandbox/workspace.json': {
            content: code,
            isBinary: false,
          },
        },
      });
    }
  } else {
    state.editor.workspaceConfigCode = code;
  }
};

export const updatePreviewCode: Action = ({ state, effects }) => {
  if (state.preferences.settings.instantPreviewEnabled) {
    effects.preview.executeCodeImmediately();
  } else {
    effects.preview.executeCode();
  }
};
