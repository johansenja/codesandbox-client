import {
  Button,
  FormField,
  Input,
  Stack,
  Textarea,
} from '@codesandbox/components';
import css from '@styled-system/css';
import { useOvermind } from 'app/overmind';
import React, { ChangeEvent } from 'react';

export const CommitForm = () => {
  const {
    actions: {
      git: {
        createCommitClicked,
        createPrClicked,
        descriptionChanged,
        subjectChanged,
      },
    },
    state: {
      editor: {
        sandbox: { isAllModulesSynced },
      },
      git: { description, originalGitChanges, subject },
    },
  } = useOvermind();

  const hasWriteAccess = (rights: string = '') =>
    ['admin', 'write'].includes(rights);

  const modulesNotSaved = !isAllModulesSynced;

  const changeSubject = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => subjectChanged({ subject: value });

  const changeDescription = ({
    target: { value },
  }: ChangeEvent<HTMLTextAreaElement>) =>
    descriptionChanged({ description: value });

  return (
    <>
      <Stack as="form" direction="vertical" gap={1} marginX={2}>
        <FormField direction="vertical" label="Commit message">
          <Input
            css={css({ marginTop: 2 })}
            placeholder="Subject"
            onChange={changeSubject}
            value={subject}
          />
        </FormField>
        <FormField direction="vertical" label="Commit description" hideLabel>
          <Textarea
            maxLength={280}
            placeholder="Description"
            onChange={changeDescription}
            value={description}
          />
        </FormField>
        <Stack gap={2}>
          {hasWriteAccess(originalGitChanges?.rights) && (
            <Button
              variant="secondary"
              disabled={!subject || modulesNotSaved}
              onClick={() => createCommitClicked()}
            >
              Commit
            </Button>
          )}

          <Button
            variant="secondary"
            disabled={!subject || modulesNotSaved}
            onClick={() => createPrClicked()}
          >
            Open PR
          </Button>
        </Stack>
      </Stack>
    </>
  );
};
