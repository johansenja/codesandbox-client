import {
  getDirectoryPath,
  getModulePath,
  getModulesAndDirectoriesInDirectory,
  resolveDirectoryWrapped,
  resolveModule,
  resolveModuleWrapped,
} from '@codesandbox/common/lib/sandbox/modules';
import getTemplate, { TemplateType } from '@codesandbox/common/lib/templates';
import { generateFileFromSandbox } from '@codesandbox/common/lib/templates/configuration/package-json';
import {
  CustomTemplate,
  Directory,
  Module,
  ModuleCorrection,
  ModuleError,
  PermissionType,
  Sandbox,
} from '@codesandbox/common/lib/types';
import { getSandboxName } from '@codesandbox/common/lib/utils/get-sandbox-name';
import {
  defaultOpenedModule as getDefaultOpenedModule,
  mainModule as getMainModule,
} from 'app/overmind/utils/main-module';
import { parseConfigurations } from 'app/overmind/utils/parse-configurations';
import { json } from 'overmind';

export class EditorSandbox {
  private currentSandbox: Sandbox = {} as Sandbox;
  private currentModuleShortid: string | null = null;
  private changedModuleShortids: string[] = [];
  public errors: ModuleError[];
  public corrections: ModuleCorrection[];
  private getModuleParents(modules, directories, id): string[] {
    const module = modules.find(moduleEntry => moduleEntry.id === id);

    if (!module) return [];

    let directory = directories.find(
      directoryEntry => directoryEntry.shortid === module.directoryShortid
    );
    let directoryIds: string[] = [];
    while (directory != null) {
      directoryIds = [...directoryIds, directory.id];
      directory = directories.find(
        directoryEntry => directoryEntry.shortid === directory.directoryShortid // eslint-disable-line
      );
    }

    return directoryIds;
  }

  get id() {
    return this.currentSandbox.id;
  }

  get name() {
    return getSandboxName(this.currentSandbox);
  }

  get author() {
    return this.currentSandbox.author;
  }

  get privacy() {
    return this.currentSandbox.privacy;
  }

  get forkedFromSandbox() {
    return this.currentSandbox.forkedFromSandbox;
  }

  get forkedTemplateSandbox() {
    return this.currentSandbox.forkedTemplateSandbox;
  }

  get isForkedFromSandbox() {
    return this.currentSandbox.forkedFromSandbox;
  }

  get isForkedTemplateSandbox() {
    return this.currentSandbox.forkedTemplateSandbox;
  }

  get description() {
    return this.currentSandbox.description;
  }

  get sourceId() {
    return this.currentSandbox.sourceId;
  }

  get collection() {
    return this.currentSandbox.collection;
  }

  get isAllModulesSynced() {
    return !this.changedModuleShortids.length;
  }

  get version() {
    return this.currentSandbox?.version ?? 0;
  }

  get title() {
    return this.currentSandbox?.title ?? '';
  }

  get modules() {
    return this.currentSandbox?.modules ?? [];
  }

  get roomId() {
    return this.currentSandbox.roomId;
  }

  get parsedConfigurations() {
    return parseConfigurations(this.currentSandbox);
  }

  get customTemplate() {
    return this.currentSandbox.customTemplate;
  }

  get packageJson() {
    return this.currentSandbox.modules.find(
      m => m.directoryShortid == null && m.title === 'package.json'
    );
  }

  get packageJsonCode() {
    const packageJSON = this.packageJson;

    if (!packageJSON) {
      return null;
    }

    return packageJSON.code
      ? packageJSON.code
      : generateFileFromSandbox(this.currentSandbox);
  }

  get isFrozen() {
    return this.currentSandbox?.isFrozen ?? false;
  }

  get directories() {
    return this.currentSandbox?.directories ?? [];
  }

  get owned() {
    return this.currentSandbox?.owned ?? false;
  }

  get previewSecret() {
    return this.currentSandbox.previewSecret;
  }

  get team() {
    return this.currentSandbox.team;
  }

  get template() {
    return this.currentSandbox.template;
  }

  get templateDefinition() {
    return this.currentSandbox
      ? getTemplate(this.currentSandbox.template)
      : null;
  }

  get environmentVariables() {
    return this.currentSandbox.environmentVariables;
  }

  get currentModule() {
    if (!this.currentModuleShortid) {
      return null;
    }
    return this.getModule(this.currentModuleShortid) || null;
  }

  get likeCount() {
    return this.currentSandbox.likeCount;
  }

  get sandboxConfig() {
    return this.modules.find(
      x => x.directoryShortid == null && x.title === 'sandbox.config.json'
    );
  }

  get originalGit() {
    return this.currentSandbox.originalGit;
  }

  get userLiked() {
    return this.currentSandbox.userLiked;
  }

  get tags() {
    return this.currentSandbox.tags;
  }

  get changedModules() {
    return this.currentSandbox.modules.filter(module =>
      this.changedModuleShortids.includes(module.shortid)
    );
  }

  get alias() {
    return this.currentSandbox.alias;
  }

  get externalResources() {
    return this.currentSandbox.externalResources;
  }

  get git() {
    return this.currentSandbox.git;
  }

  get mainModule() {
    return this.currentSandbox
      ? getMainModule(this.currentSandbox, this.parsedConfigurations)
      : null;
  }

  isCurrentModule(module: Module) {
    return module.shortid === this.currentModuleShortid;
  }

  getModulePath(module: Module) {
    return getModulePath(this.modules, this.directories, module.id);
  }

  getDirectoryPath(directory: Directory) {
    return getDirectoryPath(this.modules, this.directories, directory.id);
  }

  getModule(moduleShortid: string) {
    return this.modules.find(
      moduleItem => moduleItem.shortid === moduleShortid
    );
  }

  getDirectory(directoryShortid: string) {
    return (
      this.directories.find(
        directoryItem => directoryItem.shortid === directoryShortid
      ) || null
    );
  }

  getModuleByPath(path: string) {
    return resolveModule(
      path.replace(/^\/sandbox\//, ''),
      this.modules,
      this.directories
    );
  }

  getModuleById(id: string) {
    return this.modules.find(moduleItem => moduleItem.id === id);
  }

  addModules(modules: Module[]) {
    this.currentSandbox.modules = this.currentSandbox.modules.concat(modules);
  }

  addDirectories(directories: Directory[]) {
    this.currentSandbox.directories = this.currentSandbox.directories.concat(
      directories
    );
  }

  shouldDirectoryBeOpen(directoryShortid: string) {
    const { modules, directories } = this.currentSandbox;
    const currentModuleParents = this.getModuleParents(
      modules,
      directories,
      this.currentModuleShortid
    );
    const isParentOfModule = currentModuleParents.includes(directoryShortid);

    return isParentOfModule;
  }

  setEnvironmentVariables(environmentVariables: { [key: string]: string }) {
    if (!this.currentSandbox) {
      throw new Error('No Sandbox set');
    }

    this.currentSandbox.environmentVariables = environmentVariables;
  }

  hasPermission(permission: PermissionType) {
    return this.currentSandbox.authorization === permission;
  }

  toggleLiked() {
    if (this.userLiked) {
      this.currentSandbox.likeCount--;
    } else {
      this.currentSandbox.likeCount++;
    }

    this.currentSandbox.userLiked = !this.currentSandbox.userLiked;
  }

  hasFeature(feature: string) {
    return Boolean(
      this.currentSandbox.featureFlags &&
        this.currentSandbox.featureFlags[feature]
    );
  }

  set(sandbox: Sandbox) {
    Object.assign(this.currentSandbox, sandbox);
    const defaultOpenedModule = getDefaultOpenedModule(
      sandbox,
      this.parsedConfigurations
    );
    this.setCurrentModule(defaultOpenedModule);
    this.errors = [];
    this.corrections = [];
  }

  get() {
    return this.currentSandbox;
  }

  setCurrentModule(module: Module) {
    this.currentModuleShortid = module.shortid;
  }

  setTemplate(template: TemplateType) {
    this.currentSandbox.template = template;
  }

  setTitle(title: string) {
    this.currentSandbox.title = title;
  }

  setDescription(description: string) {
    this.currentSandbox.description = description;
  }

  setAlias(alias: string) {
    this.currentSandbox.alias = alias;
  }

  setOwned(owned: boolean) {
    this.currentSandbox.owned = owned;
  }

  setExternalResources(externalResources: string[]) {
    this.currentSandbox.externalResources = externalResources;
  }

  setTags(tags: string[]) {
    this.currentSandbox.tags = tags;
  }

  setCustomTemplate(template: CustomTemplate | null) {
    this.currentSandbox.customTemplate = template;
  }

  setPrivacy(privacy: 0 | 1 | 2) {
    this.currentSandbox.privacy = privacy;
  }

  setPreviewSecret(previewSecret: string | null) {
    this.currentSandbox.previewSecret = previewSecret;
  }

  setTeam(team: { id: string; name: string }) {
    this.currentSandbox.team = team;
  }

  setRoomId(roomId: string) {
    this.currentSandbox.roomId = roomId;
  }

  setCollection(collection: { path: string }) {
    this.currentSandbox.collection = collection;
  }

  setLiked(liked: boolean) {
    this.currentSandbox.userLiked = liked;
  }

  unsetCurrentModule() {
    this.currentModuleShortid = null;
  }

  addModule(module: Module) {
    this.currentSandbox.modules.push(module);

    return this.currentSandbox.modules[this.currentSandbox.modules.length - 1];
  }

  removeModule(module: Module) {
    return this.currentSandbox.modules.splice(
      this.currentSandbox.modules.indexOf(module),
      1
    )[0];
  }

  removeDirectory(directory: Directory) {
    return this.currentSandbox.directories.splice(
      this.currentSandbox.directories.indexOf(directory),
      1
    )[0];
  }

  getModulesAndDirectoriesInDirectory(directory: Directory) {
    return getModulesAndDirectoriesInDirectory(
      directory,
      this.modules,
      this.directories
    );
  }

  clearErrors() {
    this.errors = [];
  }

  clearCorrections() {
    this.corrections = [];
  }

  setFrozen(isFrozen: boolean) {
    this.currentSandbox.isFrozen = isFrozen;
  }

  addError(error: ModuleError) {
    const module = this.getModuleByPath(error.path);

    module.errors.push(json(error));
    this.errors.push(error);
  }

  addCorrection(correction: ModuleCorrection) {
    if (correction.path) {
      const module = this.getModuleByPath(correction.path);

      module.corrections.push(json(correction));
      this.corrections.push(correction);
    }
  }

  addDirectory(directory: Directory) {
    this.directories.push(directory);
  }

  sync(newSandbox: Sandbox, updates: any[]) {
    const oldSandbox = this.currentSandbox;
    updates.forEach(update => {
      const { op, path, type } = update;

      if (type === 'file') {
        const resolveModuleOld = resolveModuleWrapped(oldSandbox);
        const resolveModuleNew = resolveModuleWrapped(newSandbox);
        const oldModule = resolveModuleOld(path);
        if (op === 'update') {
          const newModule = resolveModuleNew(path);

          if (newModule) {
            if (oldModule) {
              const modulePos = oldSandbox.modules.indexOf(oldModule);
              Object.assign(oldSandbox.modules[modulePos], newModule);
            } else {
              oldSandbox.modules.push(newModule);
            }
          }
        } else if (op === 'delete' && oldModule) {
          oldSandbox.modules.splice(oldSandbox.modules.indexOf(oldModule), 1);
        }
      } else {
        const resolveDirectoryOld = resolveDirectoryWrapped(oldSandbox);
        const resolveDirectoryNew = resolveDirectoryWrapped(newSandbox);

        if (op === 'update') {
          // Create
          const newDirectory = resolveDirectoryNew(path);
          if (newDirectory) {
            oldSandbox.directories.push(newDirectory);
          }
        } else {
          const oldDirectory = resolveDirectoryOld(path);
          if (oldDirectory) {
            const directory = oldSandbox.directories.find(
              directoryItem => directoryItem.shortid === oldDirectory.shortid
            );
            if (directory) {
              oldSandbox.directories.splice(
                oldSandbox.directories.indexOf(directory),
                1
              );
            }
          }
        }
      }
    });
  }
}
