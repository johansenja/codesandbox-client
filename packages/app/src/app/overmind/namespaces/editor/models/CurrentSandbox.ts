import { resolveModule } from '@codesandbox/common/lib/sandbox/modules';
import getTemplate from '@codesandbox/common/lib/templates';
import { generateFileFromSandbox } from '@codesandbox/common/lib/templates/configuration/package-json';
import { ParsedConfigurationFiles } from '@codesandbox/common/lib/templates/template';
import {
  CustomTemplate,
  GitInfo,
  Module,
  ModuleCorrection,
  ModuleError,
  PermissionType,
  Sandbox,
} from '@codesandbox/common/lib/types';
import { mainModule as getMainModule } from 'app/overmind/utils/main-module';
import { parseConfigurations } from 'app/overmind/utils/parse-configurations';
import { json } from 'overmind';

export class CurrentSandbox {
  private sandboxes: {
    [id: string]: Sandbox;
  } = {};

  private currentSandboxId: string | null;
  private currentModuleShortid: string | null = null;
  private changedModuleShortids: string[] = [];
  private errors: ModuleError[];
  private corrections: ModuleCorrection[];
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

  getId(): string | null {
    return this.sandboxes[this.currentSandboxId]?.id ?? null;
  }

  isAllModulesSynced() {
    return !this.changedModuleShortids.length;
  }

  getVersion() {
    return this.sandboxes[this.currentSandboxId]?.version ?? 0;
  }

  getTitle() {
    return this.sandboxes[this.currentSandboxId]?.title ?? '';
  }

  getModules() {
    return this.sandboxes[this.currentSandboxId]?.modules ?? [];
  }

  getModule(moduleShortid: string): Module | null {
    return (
      (this.sandboxes[this.currentSandboxId]?.modules ?? []).find(
        moduleItem => moduleItem.shortid === moduleShortid
      ) || null
    );
  }

  getModuleByPath(path: string) {
    return resolveModule(
      path.replace(/^\/sandbox\//, ''),
      this.getModules(),
      this.getDirectories()
    );
  }

  getModuleById(id: string) {
    return this.getModules().find(moduleItem => moduleItem.id === id);
  }

  getChangedModules() {
    return this.sandboxes[this.currentSandboxId].modules.filter(module =>
      this.changedModuleShortids.includes(module.shortid)
    );
  }

  getMainModule() {
    return this.sandboxes[this.currentSandboxId]
      ? getMainModule(
          this.sandboxes[this.currentSandboxId],
          this.getParsedConfigurations()
        )
      : {};
  }

  getErrors() {
    return this.errors;
  }

  getCorrections() {
    return this.corrections;
  }

  getParsedConfigurations(): ParsedConfigurationFiles {
    return this.sandboxes[this.currentSandboxId]
      ? parseConfigurations(this.sandboxes[this.currentSandboxId])
      : {};
  }

  getCustomTemplate(): CustomTemplate | null {
    return this.sandboxes[this.currentSandboxId]?.customTemplate ?? null;
  }

  getPackageJson(): Module | null {
    if (!this.sandboxes[this.currentSandboxId]) {
      return null;
    }

    return (
      this.sandboxes[this.currentSandboxId].modules.find(
        m => m.directoryShortid == null && m.title === 'package.json'
      ) || null
    );
  }

  getPackageJsonCode(): string | null {
    const packageJSON = this.getPackageJson();

    if (!packageJSON) {
      return null;
    }

    return packageJSON.code
      ? packageJSON.code
      : generateFileFromSandbox(this.sandboxes[this.currentSandboxId]);
  }

  isFrozen() {
    return this.sandboxes[this.currentSandboxId]?.isFrozen ?? false;
  }

  getDirectories() {
    return this.sandboxes[this.currentSandboxId]?.directories ?? [];
  }

  isOwned() {
    return this.sandboxes[this.currentSandboxId]?.owned ?? false;
  }

  isCurrentModule(module: Module) {
    return module.shortid === this.currentModuleShortid;
  }

  getTeam(): { id: string; name: string } | null {
    return this.sandboxes[this.currentSandboxId]?.team ?? null;
  }

  getTemplate(): { isServer: boolean } {
    return this.sandboxes[this.currentSandboxId]
      ? getTemplate(this.sandboxes[this.currentSandboxId].template)
      : { isServer: false };
  }

  getEnvironmentVariables(): { [key: string]: string } | null {
    return this.sandboxes[this.currentSandboxId]?.environmentVariables ?? null;
  }

  getCurrentModule(): Module | null {
    return this.getModule(this.currentModuleShortid);
  }

  getSandboxConfig(): Module | null {
    return this.getModules().find(
      x => x.directoryShortid == null && x.title === 'sandbox.config.json'
    );
  }

  getOriginalGit(): GitInfo | null {
    return this.sandboxes[this.currentSandboxId].originalGit;
  }

  shouldDirectoryBeOpen(directoryShortid: string): boolean {
    if (!this.sandboxes[this.currentSandboxId]) {
      return false;
    }

    const { modules, directories } = this.sandboxes[this.currentSandboxId];
    const currentModuleParents = this.getModuleParents(
      modules,
      directories,
      this.currentModuleShortid
    );
    const isParentOfModule = currentModuleParents.includes(directoryShortid);

    return isParentOfModule;
  }

  setEnvironmentVariables(environmentVariables: { [key: string]: string }) {
    if (!this.sandboxes[this.currentSandboxId]) {
      throw new Error('No Sandbox set');
    }

    this.sandboxes[
      this.currentSandboxId
    ].environmentVariables = environmentVariables;
  }

  hasPermission(permission: PermissionType) {
    return this.sandboxes[this.currentSandboxId].authorization === permission;
  }

  isLiked() {
    return this.sandboxes[this.currentSandboxId].userLiked;
  }

  toggleLiked() {
    if (this.isLiked()) {
      this.sandboxes[this.currentSandboxId].likeCount--;
    } else {
      this.sandboxes[this.currentSandboxId].likeCount++;
    }

    this.sandboxes[this.currentSandboxId].userLiked = !this.sandboxes[
      this.currentSandboxId
    ].userLiked;
  }

  hasFeature(feature: string) {
    return Boolean(
      this.sandboxes[this.currentSandboxId].featureFlags &&
        this.sandboxes[this.currentSandboxId].featureFlags[feature]
    );
  }

  set(sandbox: Sandbox) {
    this.sandboxes[sandbox.id] = sandbox;
    this.currentSandboxId = sandbox.id;
    this.errors = [];
    this.corrections = [];
    this.currentModuleShortid = null;
  }

  get() {
    return this.sandboxes[this.currentSandboxId];
  }

  setCurrentModule(moduleShortid: string) {
    this.currentModuleShortid = moduleShortid;
  }

  unsetCurrentModule() {
    this.currentModuleShortid = null;
  }

  addModule(module: Module) {
    this.sandboxes[this.currentSandboxId].modules.push(module);
  }

  clearErrors() {
    this.errors = [];
  }

  clearCorrections() {
    this.corrections = [];
  }

  setFrozen(isFrozen: boolean) {
    this.sandboxes[this.currentSandboxId].isFrozen = isFrozen;
  }

  addError(error: ModuleError) {
    const module = this.getModuleByPath(error.path);

    module.errors.push(json(error));
    this.errors.push(error);
  }

  addCorrection(correction: ModuleCorrection) {
    const module = this.getModuleByPath(correction.path);

    module.corrections.push(json(correction));
    this.corrections.push(correction);
  }
}
