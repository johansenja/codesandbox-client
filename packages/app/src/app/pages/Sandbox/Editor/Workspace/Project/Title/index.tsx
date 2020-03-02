import { getSandboxName } from '@codesandbox/common/lib/utils/get-sandbox-name';
import { ENTER, ESC } from '@codesandbox/common/lib/utils/keycodes';
import { useOvermind } from 'app/overmind';
import React, {
  ChangeEvent,
  FunctionComponent,
  KeyboardEvent,
  useState,
} from 'react';

import { EditPenIcon } from '../elements';
import { SandboxTitle, WorkspaceInputContainer } from './elements';

type Props = {
  editable: boolean;
};
export const Title: FunctionComponent<Props> = ({ editable }) => {
  const {
    actions: {
      workspace: { sandboxInfoUpdated, valueChanged },
    },
    state: {
      editor: { sandbox: currentSandbox },
      workspace: {
        project: { title },
      },
    },
  } = useOvermind();
  const [editing, setEditing] = useState(false);

  return editing ? (
    <WorkspaceInputContainer>
      <input
        onBlur={() => {
          sandboxInfoUpdated();

          setEditing(false);
        }}
        onChange={({ target: { value } }: ChangeEvent<HTMLInputElement>) => {
          valueChanged({ field: 'title', value });
        }}
        onKeyUp={({ keyCode }: KeyboardEvent<HTMLInputElement>) => {
          if (keyCode === ENTER) {
            sandboxInfoUpdated();

            setEditing(false);
          } else if (keyCode === ESC) {
            setEditing(false);
          }
        }}
        placeholder="Title"
        ref={el => {
          if (el) {
            el.focus();
          }
        }}
        type="text"
        value={title}
      />
    </WorkspaceInputContainer>
  ) : (
    <SandboxTitle>
      {getSandboxName(currentSandbox)}

      {editable && (
        <EditPenIcon
          onClick={() => {
            valueChanged({
              field: 'title',
              value: getSandboxName(currentSandbox),
            });

            setEditing(true);
          }}
        />
      )}
    </SandboxTitle>
  );
};
