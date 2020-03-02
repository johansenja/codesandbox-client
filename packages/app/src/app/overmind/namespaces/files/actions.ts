import { Directory, Module, UploadFile } from '@codesandbox/common/lib/types';
import { getTextOperation } from '@codesandbox/common/lib/utils/diff';
import { AsyncAction } from 'app/overmind';
import { withOwnedSandbox } from 'app/overmind/factories';
import { createOptimisticModule } from 'app/overmind/utils/common';
import { INormalizedModules } from 'codesandbox-import-util-types';
import denormalize from 'codesandbox-import-utils/lib/utils/files/denormalize';

import { resolveModuleWrapped } from '../../utils/resolve-module-wrapped';
import * as internalActions from './internalActions';

export const internal = internalActions;

export const moduleRenamed: AsyncAction<{
  title: string;
  moduleShortid: string;
}> = withOwnedSandbox(
  async ({ state, actions, effects }, { title, moduleShortid }) => {
    const sandbox = state.editor.sandbox;
    const module = sandbox.getModule(moduleShortid);

    if (!module || !module.id) {
      return;
    }

    const oldTitle = module.title;
    const oldPath = module.path;

    module.title = title;
    module.path = sandbox.getModulePath(module);

    effects.vscode.sandboxFsSync.rename(
      state.editor.modulesByPath,
      oldPath!,
      module.path
    );

    await effects.vscode.updateTabsPath(oldPath!, module.path);

    if (sandbox.isCurrentModule(module)) {
      effects.vscode.openModule(module);
    }

    actions.editor.internal.updatePreviewCode();
    try {
      await effects.api.saveModuleTitle(sandbox.id, moduleShortid, title);

      if (state.live.isCurrentEditor) {
        effects.live.sendModuleUpdate(module);
      }
      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      module.title = oldTitle;
      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );

      if (sandbox.isCurrentModule(module)) {
        effects.vscode.openModule(module);
      }

      actions.editor.internal.updatePreviewCode();

      actions.internal.handleError({ message: 'Could not rename file', error });
    }
  },
  async () => {},
  'write_code'
);

export const directoryCreated: AsyncAction<{
  title: string;
  directoryShortid: string;
}> = withOwnedSandbox(
  async ({ state, effects, actions }, { title, directoryShortid }) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const optimisticId = effects.utils.createOptimisticId();
    const optimisticDirectory = {
      id: optimisticId,
      title,
      directoryShortid,
      shortid: effects.utils.createOptimisticId(),
      sourceId: sandbox.sourceId,
      insertedAt: new Date().toString(),
      updatedAt: new Date().toString(),
      type: 'directory' as 'directory',
      path: (null as unknown) as string,
    };

    sandbox.addDirectory(optimisticDirectory as Directory);
    optimisticDirectory.path = sandbox.getDirectoryPath(optimisticDirectory);
    effects.vscode.sandboxFsSync.mkdir(
      state.editor.modulesByPath,
      optimisticDirectory
    );

    try {
      const newDirectory = await effects.api.createDirectory(
        sandbox.id,
        directoryShortid,
        title
      );
      const directory = sandbox.getDirectory(optimisticDirectory.shortid);

      if (!directory) {
        effects.notificationToast.error(
          'Could not find saved directory, please refresh and try again'
        );
        return;
      }

      Object.assign(directory, {
        id: newDirectory.id,
        shortid: newDirectory.shortid,
      });

      effects.live.sendDirectoryCreated(directory);
      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      sandbox.removeDirectory(optimisticDirectory);
      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );
      actions.internal.handleError({
        message: 'Unable to save new directory',
        error,
      });
    }
  },
  async () => {},
  'write_code'
);

export const moduleMovedToDirectory: AsyncAction<{
  moduleShortid: string;
  directoryShortid: string;
}> = withOwnedSandbox(
  async ({ state, actions, effects }, { moduleShortid, directoryShortid }) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const module = sandbox.getModule(moduleShortid);

    if (!module || !module.id) {
      return;
    }

    const currentDirectoryShortid = module.directoryShortid;
    const oldPath = module.path;

    module.directoryShortid = directoryShortid;
    module.path = sandbox.getModulePath(module);

    effects.vscode.sandboxFsSync.rename(
      state.editor.modulesByPath,
      oldPath!,
      module.path
    );
    effects.vscode.openModule(module);
    actions.editor.internal.updatePreviewCode();
    try {
      await effects.api.saveModuleDirectory(
        sandbox.id,
        moduleShortid,
        directoryShortid
      );
      effects.live.sendModuleUpdate(module);
      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      module.directoryShortid = currentDirectoryShortid;
      module.path = oldPath;
      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );
      actions.internal.handleError({
        message: 'Could not save new module location',
        error,
      });
    }
  },
  async () => {},
  'write_code'
);

export const directoryMovedToDirectory: AsyncAction<{
  shortid: string;
  directoryShortid: string;
}> = withOwnedSandbox(
  async ({ state, actions, effects }, { shortid, directoryShortid }) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const directoryToMove = sandbox.getDirectory(shortid);

    if (!directoryToMove) {
      return;
    }

    const oldPath = directoryToMove.path;

    directoryToMove.directoryShortid = directoryShortid;
    directoryToMove.path = sandbox.getDirectoryPath(directoryToMove);

    // We have to recreate the whole thing as many files and folders
    // might have changed their path
    state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
      sandbox.get()
    );
    actions.editor.internal.updatePreviewCode();
    try {
      await effects.api.saveDirectoryDirectory(
        sandbox.id,
        shortid,
        directoryShortid
      );
      effects.live.sendDirectoryUpdate(directoryToMove);
      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      directoryToMove.directoryShortid = shortid;
      directoryToMove.path = oldPath;
      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );
      actions.internal.handleError({
        message: 'Could not save new directory location',
        error,
      });
    }
  },
  async () => {},
  'write_code'
);

export const directoryDeleted: AsyncAction<{
  directoryShortid;
}> = withOwnedSandbox(
  async ({ state, actions, effects }, { directoryShortid }) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const directory = sandbox.getDirectory(directoryShortid);

    if (!directory) {
      return;
    }

    const removedDirectory = sandbox.removeDirectory(directory);
    const {
      removedModules,
      removedDirectories,
    } = sandbox.getModulesAndDirectoriesInDirectory(directory);

    removedModules.forEach(removedModule => {
      effects.vscode.sandboxFsSync.unlink(
        state.editor.modulesByPath,
        removedModule
      );
      sandbox.removeModule(removedModule);
    });

    removedDirectories.forEach(removedDirectoryItem => {
      sandbox.removeDirectory(removedDirectoryItem);
    });

    // We open the main module as we do not really know if you had opened
    // any nested file of this directory. It would require complex logic
    // to figure that out. This concept is soon removed anyways
    if (sandbox.mainModule) effects.vscode.openModule(sandbox.mainModule);
    actions.editor.internal.updatePreviewCode();
    try {
      await effects.api.deleteDirectory(sandbox.id, directoryShortid);
      effects.live.sendDirectoryDeleted(directoryShortid);
      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      sandbox.addDirectory(removedDirectory);

      removedModules.forEach(removedModule => {
        sandbox.addModule(removedModule);
      });
      removedDirectories.forEach(removedDirectoryItem => {
        sandbox.addDirectory(removedDirectoryItem);
      });
      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );
      actions.internal.handleError({
        message: 'Could not delete directory',
        error,
      });
    }
  },
  async () => {},
  'write_code'
);

export const directoryRenamed: AsyncAction<{
  title: string;
  directoryShortid: string;
}> = withOwnedSandbox(
  async ({ effects, actions, state }, { title, directoryShortid }) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const directory = sandbox.getDirectory(directoryShortid);

    if (!directory) {
      return;
    }

    const oldTitle = directory.title;
    const oldPath = directory.path;

    directory.title = title;
    directory.path = sandbox.getDirectoryPath(directory);

    effects.vscode.sandboxFsSync.rename(
      state.editor.modulesByPath,
      oldPath!,
      directory.path
    );
    actions.editor.internal.updatePreviewCode();
    try {
      await effects.api.saveDirectoryTitle(sandbox.id, directoryShortid, title);

      if (state.live.isCurrentEditor) {
        effects.live.sendDirectoryUpdate(directory);
      }

      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      directory.title = oldTitle;
      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );
      actions.internal.handleError({
        message: 'Could not rename directory',
        error,
      });
    }
  },
  async () => {},
  'write_code'
);

export const gotUploadedFiles: AsyncAction<string> = async (
  { state, actions, effects },
  message
) => {
  const modal = 'storageManagement';
  effects.analytics.track('Open Modal', { modal });
  state.currentModalMessage = message;
  state.currentModal = modal;

  try {
    const uploadedFilesInfo = await effects.api.getUploads();

    state.uploadedFiles = uploadedFilesInfo.uploads;
    state.maxStorage = uploadedFilesInfo.maxSize;
    state.usedStorage = uploadedFilesInfo.currentSize;
  } catch (error) {
    actions.internal.handleError({
      message: 'Unable to get uploaded files information',
      error,
    });
  }
};

export const addedFileToSandbox: AsyncAction<Pick<
  UploadFile,
  'name' | 'url'
>> = withOwnedSandbox(
  async ({ actions, effects, state }, { name, url }) => {
    if (!state.editor.sandbox) {
      return;
    }
    actions.internal.closeModals(false);
    await actions.files.moduleCreated({
      title: name,
      directoryShortid: null,
      code: url,
      isBinary: true,
    });

    effects.executor.updateFiles(state.editor.sandbox.get());
  },
  async () => {},
  'write_code'
);

export const deletedUploadedFile: AsyncAction<string> = async (
  { actions, effects, state },
  id
) => {
  if (!state.uploadedFiles) {
    return;
  }
  const index = state.uploadedFiles.findIndex(file => file.id === id);
  const removedFiles = state.uploadedFiles.splice(index, 1);

  try {
    await effects.api.deleteUploadedFile(id);
  } catch (error) {
    state.uploadedFiles.splice(index, 0, ...removedFiles);
    actions.internal.handleError({
      message: 'Unable to delete uploaded file',
      error,
    });
  }
};

export const filesUploaded: AsyncAction<{
  files: { [k: string]: { dataURI: string; type: string } };
  directoryShortid: string;
}> = withOwnedSandbox(
  async ({ state, effects, actions }, { files, directoryShortid }) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const modal = 'uploading';
    effects.analytics.track('Open Modal', { modal });
    // What message?
    // state.currentModalMessage = message;
    state.currentModal = modal;

    try {
      const { modules, directories } = await actions.files.internal.uploadFiles(
        {
          files,
          directoryShortid,
        }
      );

      actions.files.massCreateModules({
        modules,
        directories,
        directoryShortid,
      });

      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      if (error.message.indexOf('413') !== -1) {
        actions.internal.handleError({
          message: `The uploaded file is bigger than 7MB, contact hello@codesandbox.io if you want to raise this limit`,
          error,
          hideErrorMessage: true,
        });
      } else {
        actions.internal.handleError({
          message: 'Unable to upload files',
          error,
        });
      }
    }

    actions.internal.closeModals(false);
  },
  async () => {},
  'write_code'
);

export const massCreateModules: AsyncAction<{
  modules: any;
  directories: any;
  directoryShortid: string | null;
  cbID?: string;
}> = withOwnedSandbox(
  async (
    { state, actions, effects },
    { modules, directories, directoryShortid, cbID }
  ) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const sandboxId = sandbox.id;

    try {
      const data = await effects.api.massCreateModules(
        sandboxId,
        directoryShortid,
        modules,
        directories
      );

      sandbox.addModules(data.modules);
      sandbox.addDirectories(data.directories);

      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );

      actions.editor.internal.updatePreviewCode();

      // This can happen if you have selected a deleted file in VSCode and try to save it,
      // we want to select it again
      if (!sandbox.currentModule) {
        const lastAddedModule = sandbox.modules[sandbox.modules.length - 1];

        actions.editor.internal.setCurrentModule(lastAddedModule);
      }

      if (state.live.isCurrentEditor) {
        effects.live.sendMassCreatedModules(data.modules, data.directories);
      }

      if (cbID) {
        effects.vscode.callCallback(cbID);
      }

      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      if (cbID) {
        effects.vscode.callCallbackError(cbID, error.message);
      }

      actions.internal.handleError({
        message: 'Unable to create new files',
        error,
      });
    }
  },
  async () => {},
  'write_code'
);

export const moduleCreated: AsyncAction<{
  title: string;
  directoryShortid: string | null;
  code?: string;
  isBinary?: boolean;
}> = withOwnedSandbox(
  async (
    { state, actions, effects },
    { title, directoryShortid, code, isBinary }
  ) => {
    const sandbox = state.editor.sandbox;
    if (!sandbox) {
      return;
    }
    const optimisticId = effects.utils.createOptimisticId();
    const optimisticModule = createOptimisticModule({
      id: optimisticId,
      title,
      directoryShortid: directoryShortid || null,
      shortid: effects.utils.createOptimisticId(),
      sourceId: sandbox.sourceId,
      isNotSynced: true,
      ...(code ? { code } : {}),
      ...(typeof isBinary === 'boolean' ? { isBinary } : {}),
    });

    // We have to push the module to the array before we can figure out its path,
    // this is all changing soon
    const module = sandbox.addModule(optimisticModule as Module);
    optimisticModule.path = sandbox.getModulePath(optimisticModule as Module);

    // We grab the module from the state to continue working with it (proxy)

    const template = sandbox.templateDefinition;
    const config = template && template.configurationFiles[module.path!];

    if (
      config &&
      (config.generateFileFromSandbox ||
        config.getDefaultCode ||
        config.generateFileFromState)
    ) {
      if (config.generateFileFromState) {
        module.code = config.generateFileFromState(
          state.preferences.settings.prettierConfig
        );
      } else if (config.generateFileFromSandbox) {
        module.code = config.generateFileFromSandbox(sandbox.get());
      } else if (config.getDefaultCode) {
        const resolveModule = resolveModuleWrapped(sandbox.get());

        module.code = config.getDefaultCode(sandbox.template, resolveModule);
      }
    }

    effects.vscode.sandboxFsSync.appendFile(state.editor.modulesByPath, module);
    actions.editor.internal.setCurrentModule(module);

    try {
      const updatedModule = await effects.api.createModule(sandbox.id, module);

      module.id = updatedModule.id;
      module.shortid = updatedModule.shortid;

      effects.vscode.sandboxFsSync.writeFile(
        state.editor.modulesByPath,
        module
      );
      sandbox.setCurrentModule(module);

      effects.executor.updateFiles(sandbox.get());

      if (state.live.isCurrentEditor) {
        effects.live.sendModuleCreated(module);
        // Update server with latest data
        effects.live.sendCodeUpdate(
          module.shortid,
          getTextOperation('', module.code)
        );
      }
    } catch (error) {
      sandbox.removeModule(module);
      if (sandbox.mainModule)
        actions.editor.internal.setCurrentModule(sandbox.mainModule);

      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );

      actions.internal.handleError({
        message: 'Unable to save new file',
        error,
      });
    }
  },
  async () => {},
  'write_code'
);

export const moduleDeleted: AsyncAction<{
  moduleShortid: string;
}> = withOwnedSandbox(
  async ({ state, effects, actions }, { moduleShortid }) => {
    const sandbox = state.editor.sandbox;
    const module = sandbox.getModule(moduleShortid);

    if (!module) {
      return;
    }

    const removedModule = sandbox.removeModule(module);
    const wasCurrentModule = sandbox.currentModule.shortid === moduleShortid;

    effects.vscode.sandboxFsSync.unlink(
      state.editor.modulesByPath,
      removedModule
    );

    if (wasCurrentModule && sandbox.mainModule) {
      actions.editor.internal.setCurrentModule(sandbox.mainModule);
    }

    actions.editor.internal.updatePreviewCode();

    try {
      await effects.api.deleteModule(sandbox.id, moduleShortid);

      if (state.live.isCurrentEditor) {
        effects.live.sendModuleDeleted(moduleShortid);
      }
      effects.executor.updateFiles(sandbox.get());
    } catch (error) {
      sandbox.addModule(removedModule);
      state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
        sandbox.get()
      );
      actions.internal.handleError({ message: 'Could not delete file', error });
    }
  },
  async () => {},
  'write_code'
);

export const createModulesByPath: AsyncAction<{
  cbID?: string;
  files: INormalizedModules;
}> = async ({ state, effects, actions }, { files, cbID }) => {
  const sandbox = state.editor.sandbox;
  if (!sandbox) {
    return;
  }
  const { modules, directories } = denormalize(files, sandbox.directories);

  await actions.files.massCreateModules({
    modules,
    directories,
    directoryShortid: null,
    cbID,
  });

  effects.executor.updateFiles(sandbox.get());
};

export const syncSandbox: AsyncAction<any[]> = async (
  { state, actions, effects },
  updates
) => {
  const sandbox = state.editor.sandbox;
  try {
    const newSandbox = await effects.api.getSandbox(state.editor.sandbox.id);

    sandbox.sync(newSandbox, updates);
  } catch (error) {
    if (error.response?.status === 404) {
      return;
    }

    actions.internal.handleError({
      message:
        "We weren't able to retrieve the latest files of the sandbox, please refresh",
      error,
    });
  }

  // No matter if error or not we resync the whole shabang!
  state.editor.modulesByPath = effects.vscode.sandboxFsSync.create(
    sandbox.get()
  );
};
