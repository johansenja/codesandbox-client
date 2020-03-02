import { getSandboxName } from '@codesandbox/common/lib/utils/get-sandbox-name';
import { sandboxUrl } from '@codesandbox/common/lib/utils/url-generator';
import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { Item, PropertyName, PropertyValue } from '../elements';
import { Link } from './elements';

export const ForkedFrom: FunctionComponent = () => {
  const {
    state: {
      editor: {
        sandbox: { forkedFromSandbox, forkedTemplateSandbox },
      },
    },
  } = useOvermind();

  return (
    <Item>
      <PropertyName>
        {forkedTemplateSandbox ? 'Template' : 'Forked From'}
      </PropertyName>

      <PropertyValue>
        <Link to={sandboxUrl(forkedFromSandbox || forkedTemplateSandbox)}>
          {getSandboxName(forkedFromSandbox || forkedTemplateSandbox)}
        </Link>
      </PropertyValue>
    </Item>
  );
};
