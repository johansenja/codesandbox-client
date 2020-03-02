import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { Button } from './elements';

export const PickButton: FunctionComponent = () => {
  const {
    actions: {
      explore: { pickSandboxModal },
    },
    state: {
      editor: {
        sandbox: { description, id, owned, title },
      },
    },
  } = useOvermind();

  const details = {
    description,
    id,
    title,
  };

  return (
    <Button onClick={() => pickSandboxModal(details)} secondary={owned} small>
      Pick
    </Button>
  );
};
