import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { ForkIcon, ProgressButton } from './elements';

export const ForkButton: FunctionComponent = () => {
  const {
    actions: {
      editor: { forkSandboxClicked },
    },
    state: {
      editor: {
        sandbox: { owned },
        isForkingSandbox,
      },
    },
  } = useOvermind();

  return (
    <ProgressButton
      loading={isForkingSandbox}
      onClick={forkSandboxClicked}
      secondary={owned}
      small
    >
      <ForkIcon />

      {isForkingSandbox ? 'Forking...' : 'Fork'}
    </ProgressButton>
  );
};
