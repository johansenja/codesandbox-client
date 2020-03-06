import { basename } from 'path';

import Tooltip from '@codesandbox/common/lib/components/Tooltip';
import track from '@codesandbox/common/lib/utils/analytics';
import { getSandboxName } from '@codesandbox/common/lib/utils/get-sandbox-name';
import { ESC } from '@codesandbox/common/lib/utils/keycodes';
import { useOvermind } from 'app/overmind';
import React, {
  ChangeEvent,
  FunctionComponent,
  KeyboardEvent,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { animated, useSpring } from 'react-spring';

import { PrivacyTooltip } from '../PrivacyTooltip';
import {
  Container,
  Folder,
  FolderName,
  Form,
  Main,
  Name,
  NameInput,
  TemplateBadge,
} from './elements';

const noop = () => undefined;
export const SandboxName: FunctionComponent = () => {
  const {
    actions: {
      modalOpened,
      workspace: { sandboxInfoUpdated, valueChanged },
    },
    state: {
      editor: { sandbox },
      isLoggedIn,
    },
  } = useOvermind();
  const [updatingName, setUpdatingName] = useState(false);
  const [name, setName] = useState('');
  const spring = useSpring({
    opacity: updatingName ? 0 : 1,
    pointerEvents: updatingName ? 'none' : 'initial',
  });

  if (!sandbox.id) {
    return null;
  }

  const sandboxName = getSandboxName(sandbox.get()) || 'Untitled';

  const updateSandboxInfo = () => {
    sandboxInfoUpdated();

    setUpdatingName(false);
  };

  const submitNameChange = (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();

    updateSandboxInfo();

    track('Change Sandbox Name From Header');
  };

  const handleNameClick = () => {
    setUpdatingName(true);

    setName(sandboxName);
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === ESC) {
      updateSandboxInfo();
    }
  };

  const handleBlur = () => {
    updateSandboxInfo();
  };

  const handleInputUpdate = (e: ChangeEvent<HTMLInputElement>) => {
    valueChanged({
      field: 'title',
      value: e.target.value,
    });

    setName(e.target.value);
  };

  const value = name !== 'Untitled' && updatingName ? name : '';

  const folderName = sandbox.collection
    ? basename(sandbox.collection.path) ||
      (sandbox.team ? sandbox.team.name : 'My Sandboxes')
    : 'My Sandboxes';

  const { customTemplate, owned } = sandbox;

  return (
    <Main>
      <Container>
        {!customTemplate && owned && (
          <animated.div style={spring}>
            <Folder>
              {isLoggedIn ? (
                <FolderName
                  onClick={() => modalOpened({ modal: 'moveSandbox' })}
                >
                  {folderName}
                </FolderName>
              ) : (
                'Anonymous '
              )}

              <span role="presentation">/ </span>
            </Folder>
          </animated.div>
        )}

        {updatingName ? (
          <Form onSubmit={submitNameChange}>
            <NameInput
              autoFocus
              innerRef={(el: HTMLInputElement) => {
                if (el) {
                  el.focus();
                }
              }}
              onBlur={handleBlur}
              onChange={handleInputUpdate}
              onKeyUp={handleKeyUp}
              placeholder={name}
              value={value}
              arial-label="sandbox name"
            />
          </Form>
        ) : (
          <Name
            as={owned ? 'button' : 'span'}
            onClick={owned ? handleNameClick : noop}
            owned={owned}
            aria-label={
              owned ? `${sandboxName}, change sandbox name` : sandboxName
            }
          >
            {sandboxName}
          </Name>
        )}

        {!updatingName ? <PrivacyTooltip /> : null}

        {sandbox.customTemplate ? (
          <Tooltip
            content={
              <>
                This sandbox is a template, you can learn about templates in the{' '}
                <Link target="_blank" to="/docs/templates">
                  docs
                </Link>
                .
              </>
            }
            delay={0}
            interactive
            placement="bottom"
          >
            <TemplateBadge color={customTemplate.color}>Template</TemplateBadge>
          </Tooltip>
        ) : null}
      </Container>
    </Main>
  );
};
