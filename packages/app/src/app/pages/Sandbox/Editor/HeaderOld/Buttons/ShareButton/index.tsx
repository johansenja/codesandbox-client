import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { Button, ShareIcon } from './elements';

export const ShareButton: FunctionComponent = () => {
  const {
    actions: { modalOpened },
    state: {
      editor: {
        sandbox: { owned },
      },
    },
  } = useOvermind();

  return (
    <Button
      onClick={() => modalOpened({ modal: 'share' })}
      secondary={owned}
      small
    >
      <ShareIcon />
      Share
    </Button>
  );
};
