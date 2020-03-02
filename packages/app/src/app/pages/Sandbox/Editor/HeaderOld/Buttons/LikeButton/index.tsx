import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { LikeHeart } from './elements';

export const LikeButton: FunctionComponent = () => {
  const {
    state: {
      editor: { sandbox },
    },
  } = useOvermind();

  return (
    <LikeHeart
      colorless
      disableTooltip
      highlightHover
      sandbox={sandbox.get()}
      text={sandbox.likeCount}
    />
  );
};
