import Tooltip from '@codesandbox/common/lib/components/Tooltip';
import getTemplateDefinition from '@codesandbox/common/lib/templates';
import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { Item, PropertyName, PropertyValue, QuestionIcon } from '../elements';
import { BundlerLink } from './elements';

export const Environment: FunctionComponent = () => {
  const {
    state: {
      editor: {
        sandbox: { template },
      },
    },
  } = useOvermind();
  const { url } = getTemplateDefinition(template);

  return (
    <Item>
      <PropertyName>
        Environment{' '}
        <Tooltip
          boundary="viewport"
          content={
            <>
              The environment determines how a sandbox is executed, you can find
              more info{' '}
              <a href="/docs/environment" target="_blank">
                here
              </a>
              .
            </>
          }
          interactive
        >
          <QuestionIcon />
        </Tooltip>
      </PropertyName>

      <PropertyValue>
        <BundlerLink href={url}>{template}</BundlerLink>
      </PropertyValue>
    </Item>
  );
};
