import { Button, Element } from '@codesandbox/components';
import { Overlay } from 'app/components/Overlay';
import { useOvermind } from 'app/overmind';
import React, { FunctionComponent } from 'react';

import { AddCollaboratorForm } from './AddCollaboratorForm';
import { ButtonActions } from './ButtonActions';
import { LinkPermissions } from './Collaborator';
import { CollaboratorList } from './CollaboratorList';
import { Container, HorizontalSeparator } from './elements';
import { AddPeople } from './icons';

const CollaboratorContent = () => {
  const { state } = useOvermind();

  const isOwner = state.editor.sandbox.hasPermission('owner');

  return (
    <Container direction="vertical">
      <Element padding={4}>
        <LinkPermissions readOnly={!isOwner} />
        {isOwner && (
          <Element paddingTop={4}>
            <AddCollaboratorForm />
          </Element>
        )}
      </Element>

      <HorizontalSeparator />

      <CollaboratorList />

      <HorizontalSeparator />

      <Element padding={4}>
        <ButtonActions />
      </Element>
    </Container>
  );
};

export const Collaborators: FunctionComponent = () => (
  <>
    <Overlay
      noHeightAnimation={false}
      event="Collaborators"
      content={CollaboratorContent}
    >
      {open => (
        <Button onClick={() => open()} variant="link">
          <AddPeople width={24} height={24} />
        </Button>
      )}
    </Overlay>
  </>
);
