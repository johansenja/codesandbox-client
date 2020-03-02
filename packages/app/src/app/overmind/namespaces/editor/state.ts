import { getPreviewTabs } from '@codesandbox/common/lib/templates/devtools';
import { ViewConfig } from '@codesandbox/common/lib/templates/template';
import {
  DevToolsTabPosition,
  DiffTab,
  ModuleTab,
  SandboxFs,
  Tabs,
  WindowOrientation,
} from '@codesandbox/common/lib/types';
import { getSandboxOptions } from '@codesandbox/common/lib/url';
import { Derive } from 'app/overmind';
import immer from 'immer';

import { EditorSandbox } from './models/EditorSandbox';

type State = {
  isForkingSandbox: boolean;
  // TODO: What is this really? Could not find it in Cerebral, but
  // EditorPreview is using it... weird stuff
  devToolTabs: Derive<State, ViewConfig[]>;
  isLoading: boolean;
  notFound: boolean;
  error: string | null;
  isResizing: boolean;
  currentTabId: string | null;
  tabs: Tabs;
  isInProjectView: boolean;
  initialPath: string;
  highlightedLines: number[];
  isUpdatingPrivacy: boolean;
  quickActionsOpen: boolean;
  previewWindowVisible: boolean;
  workspaceConfigCode: string;
  statusBar: boolean;
  previewWindowOrientation: WindowOrientation;
  canWriteCode: Derive<State, boolean>;
  sandbox: EditorSandbox;
  currentTab: Derive<State, ModuleTab | DiffTab | undefined>;
  modulesByPath: SandboxFs;
  isAdvancedEditor: Derive<State, boolean>;
  currentDevToolsPosition: DevToolsTabPosition;
  sessionFrozen: boolean;
};

export const state: State = {
  isForkingSandbox: false,
  isLoading: true,
  notFound: false,
  error: null,
  isResizing: false,
  modulesByPath: {},
  currentTabId: null,
  tabs: [],
  sessionFrozen: true,
  isInProjectView: false,
  initialPath: '/',
  highlightedLines: [],
  isUpdatingPrivacy: false,
  quickActionsOpen: false,
  previewWindowVisible: true,
  statusBar: true,
  previewWindowOrientation:
    window.innerHeight / window.innerWidth > 0.9
      ? WindowOrientation.HORIZONTAL
      : WindowOrientation.VERTICAL,

  /**
   * Normally we save this code in a file (.codesandbox/workspace.json), however, when someone
   * doesn't own a sandbox and changes the UI we don't want to fork the sandbox (yet). That's
   * why we introduce this field until we have datasources. When we have datasources we can store
   * the actual content in the localStorage.
   */
  workspaceConfigCode: '',
  currentDevToolsPosition: {
    devToolIndex: 0,
    tabPosition: 0,
  },
  canWriteCode: ({ sandbox: currentSandbox }) =>
    currentSandbox.hasPermission('write_code'),
  sandbox: new EditorSandbox(),
  currentTab: ({ currentTabId, sandbox: currentSandbox, tabs }) => {
    if (currentTabId) {
      const foundTab = tabs.find(tab => 'id' in tab && tab.id === currentTabId);

      if (foundTab) {
        return foundTab;
      }
    }

    return tabs.find(
      tab =>
        'moduleShortid' in tab &&
        tab.moduleShortid === currentSandbox.currentModule.shortid
    );
  },
  /**
   * We have two types of editors in CodeSandbox: an editor focused on smaller projects and
   * an editor that works with bigger projects that run on a container. The advanced editor
   * only has added features, so it's a subset on top of the existing editor.
   */
  isAdvancedEditor: ({ sandbox: currentSandbox }) =>
    Boolean(
      currentSandbox.templateDefinition &&
        currentSandbox.templateDefinition.isServer &&
        currentSandbox.owned
    ),

  devToolTabs: ({ sandbox, workspaceConfigCode: intermediatePreviewCode }) => {
    const parsedConfigurations = sandbox.parsedConfigurations;
    if (!parsedConfigurations) {
      return [];
    }

    const views = getPreviewTabs(
      sandbox.get(),
      parsedConfigurations,
      intermediatePreviewCode
    );

    // Do it in an immutable manner, prevents changing the original object
    return immer(views, draft => {
      const sandboxConfig = sandbox.sandboxConfig;
      let view = 'browser';
      if (sandboxConfig) {
        try {
          view = JSON.parse(sandboxConfig.code || '').view || 'browser';
        } catch (e) {
          /* swallow */
        }
      }

      const sandboxOptions = getSandboxOptions(location.href);
      if (
        sandboxOptions.previewWindow &&
        (sandboxOptions.previewWindow === 'tests' ||
          sandboxOptions.previewWindow === 'console')
      ) {
        // Backwards compatibility for ?previewwindow=

        view = sandboxOptions.previewWindow;
      }

      if (view !== 'browser') {
        // Backwards compatibility for sandbox.config.json
        if (view === 'console') {
          draft[0].views = draft[0].views.filter(
            t => t.id !== 'codesandbox.console'
          );
          draft[0].views.unshift({ id: 'codesandbox.console' });
        } else if (view === 'tests') {
          draft[0].views = draft[0].views.filter(
            t => t.id !== 'codesandbox.tests'
          );
          draft[0].views.unshift({ id: 'codesandbox.tests' });
        }
      }
    });
  },
};
