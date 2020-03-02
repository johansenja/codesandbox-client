import { useOvermind } from 'app/overmind';
import React from 'react';

import { Dependencies } from './Dependencies';
import { ExternalResources } from './ExternalResources';
import { Files } from './Files';

export const Explorer = () => {
  const {
    state: { editor },
  } = useOvermind();

  const template = editor.sandbox.template;

  return (
    <>
      <Files />
      {template !== 'static' && (
        <>
          <Dependencies />
          <ExternalResources />
        </>
      )}
    </>
  );
};
