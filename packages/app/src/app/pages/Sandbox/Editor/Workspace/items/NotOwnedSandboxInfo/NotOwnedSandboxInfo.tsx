import Margin from '@codesandbox/common/lib/components/spacing/Margin';
import { useOvermind } from 'app/overmind';
import React, { useState } from 'react';

import { Dependencies } from '../../Dependencies';
import { Files } from '../../Files';
import { BookmarkTemplateButton } from '../../Project/BookmarkTemplateButton';
import { WorkspaceItem } from '../../WorkspaceItem';
import { SandboxInfo } from './SandboxInfo';

export const NotOwnedSandboxInfo = () => {
  const [editActions, setEditActions] = useState(null);
  const {
    state: { editor, hasLogIn },
  } = useOvermind();
  const staticTemplate = editor.sandbox.template === 'static';

  return (
    <div style={{ marginTop: '1rem' }}>
      <Margin bottom={1.5}>
        <SandboxInfo sandbox={editor.sandbox.get()} />
        {editor.sandbox.customTemplate && hasLogIn && (
          <BookmarkTemplateButton />
        )}
      </Margin>

      <WorkspaceItem actions={editActions} defaultOpen title="Files">
        <Files setEditActions={setEditActions} />
      </WorkspaceItem>
      {!staticTemplate ? (
        <WorkspaceItem defaultOpen title="Dependencies">
          <Dependencies />
        </WorkspaceItem>
      ) : null}
    </div>
  );
};
