import getTemplate from '@codesandbox/common/lib/templates';
import { hasPermission } from '@codesandbox/common/lib/utils/permission';

export interface INavigationItem {
  id: string;
  name: string;
  hasCustomHeader?: boolean;
  defaultOpen?: boolean;
  /**
   * If the item is not applicable in the current situation we sometimes still
   * want to show it because of visibility. This boolean decides that.
   */
  showAsDisabledIfHidden?: boolean;
}

export const PROJECT: INavigationItem = {
  id: 'project',
  name: 'Sandbox Info',
};

export const PROJECT_TEMPLATE: INavigationItem = {
  ...PROJECT,
  name: 'Template Info',
};

export const PROJECT_SUMMARY: INavigationItem = {
  id: 'project-summary',
  name: 'Sandbox Info',
  hasCustomHeader: true,
};

export const FILES: INavigationItem = {
  id: 'files',
  name: 'Explorer',
  hasCustomHeader: true,
  defaultOpen: true,
};

export const GITHUB: INavigationItem = {
  id: 'github',
  name: 'GitHub',
  showAsDisabledIfHidden: true,
};

export const DEPLOYMENT: INavigationItem = {
  id: 'deploy',
  name: 'Deployment',
  showAsDisabledIfHidden: true,
};

export const CONFIGURATION: INavigationItem = {
  id: 'config',
  name: 'Configuration Files',
};

export const LIVE: INavigationItem = {
  id: 'live',
  name: 'Live',
  showAsDisabledIfHidden: true,
};

export const SERVER: INavigationItem = {
  id: 'server',
  name: 'Server Control Panel',
};

export function getDisabledItems(store: any): INavigationItem[] {
  const { sandbox } = store.editor;

  if (!sandbox.owned || !store.isLoggedIn) {
    return [GITHUB, DEPLOYMENT, LIVE];
  }

  return [];
}

export default function getItems(store: any): INavigationItem[] {
  if (
    store.live.isLive &&
    !store.editor.sandbox.git &&
    !(
      store.live.isOwner ||
      (store.user &&
        store.live &&
        store.live.roomInfo &&
        store.live.roomInfo.ownerIds.indexOf(store.user.id) > -1)
    )
  ) {
    return [FILES, LIVE];
  }

  const { sandbox } = store.editor;

  if (!sandbox.owned) {
    return [PROJECT_SUMMARY, CONFIGURATION];
  }

  const isCustomTemplate = !!sandbox.customTemplate;
  const items = [
    isCustomTemplate ? PROJECT_TEMPLATE : PROJECT,
    FILES,
    CONFIGURATION,
  ];

  if (store.isLoggedIn && sandbox) {
    const templateDef = getTemplate(sandbox.template);
    if (templateDef.isServer) {
      items.push(SERVER);
    }
  }

  if (store.isLoggedIn && sandbox && !sandbox.git) {
    items.push(GITHUB);
  }

  if (store.isLoggedIn) {
    items.push(DEPLOYMENT);
  }

  if (
    store.isLoggedIn &&
    sandbox &&
    hasPermission(sandbox.authorization, 'write_code')
  ) {
    items.push(LIVE);
  }

  return items;
}
