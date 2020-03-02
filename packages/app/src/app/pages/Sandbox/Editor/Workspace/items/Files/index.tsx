import { useOvermind } from 'app/overmind';
import React, { useState } from 'react';

import { Dependencies } from '../../Dependencies';
import { ItemTitle } from '../../elements';
import { Files } from '../../Files';
import { WorkspaceItem } from '../../WorkspaceItem';

export const FilesItem = () => {
  const [editActions, setEditActions] = useState(null);
  const {
    state: { editor },
  } = useOvermind();
  const staticTemplate = editor.sandbox.template === 'static';

  return (
    <div>
      <ItemTitle>
        <span style={{ display: 'inline-block', width: '100%' }}>Explorer</span>{' '}
        {editActions}
      </ItemTitle>
      <div style={{ paddingBottom: '1.75rem' }}>
        <Files setEditActions={setEditActions} />
      </div>
      {!staticTemplate ? (
        <WorkspaceItem defaultOpen title="Dependencies">
          <Dependencies />
        </WorkspaceItem>
      ) : null}
    </div>
  );
};
