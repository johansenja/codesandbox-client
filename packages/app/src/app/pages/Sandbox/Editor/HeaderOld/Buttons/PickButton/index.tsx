import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { Button } from './elements';

export const PickButton: FunctionComponent = () => {
  const {
    actions: {
      explore: { pickSandboxModal },
    },
    state: {
      editor: { sandbox },
    },
  } = useOvermind();

  return (
    <Button
      onClick={() =>
        pickSandboxModal({
          description: sandbox.description,
          id: sandbox.id,
          title: sandbox.title,
        })
      }
      secondary={sandbox.owned}
      small
    >
      Pick
    </Button>
  );
};
