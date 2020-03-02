import { Collapsible, Element, Stack, Text } from '@codesandbox/components';
import { useOvermind } from 'app/overmind';
import React, { FunctionComponent, useEffect } from 'react';

import { Netlify } from './Netlify';
import { NotLoggedIn } from './NotLoggedIn';
import { NotOwner } from './NotOwner';
import { Zeit } from './Zeit';

export const Deployment: FunctionComponent = () => {
  const {
    actions: {
      deployment: { getDeploys },
    },
    state: {
      editor: {
        sandbox: { owned },
      },
      isLoggedIn,
    },
  } = useOvermind();

  useEffect(() => {
    if (owned && isLoggedIn) getDeploys();
  }, [getDeploys, isLoggedIn, owned]);

  if (!isLoggedIn) return <NotLoggedIn />;
  if (!owned) return <NotOwner />;

  return (
    <Collapsible title="Deployment" defaultOpen>
      <Element paddingX={2}>
        <Text variant="muted" block marginBottom={6}>
          You can deploy a production version of your sandbox using one of our
          supported providers - Netlify or ZEIT.
        </Text>
        <Stack direction="vertical" gap={5}>
          <Zeit />
          <Netlify />
        </Stack>
      </Element>
    </Collapsible>
  );
};
