import getIcon from '@codesandbox/common/lib/templates/icons';
import { getSandboxName } from '@codesandbox/common/lib/utils/get-sandbox-name';
import {
  profileUrl,
  sandboxUrl,
} from '@codesandbox/common/lib/utils/url-generator';
import {
  Avatar,
  Button,
  Collapsible,
  Element,
  Label,
  Link,
  List,
  ListAction,
  ListItem,
  Stack,
  Stats,
  Switch,
  Tags,
  Text,
} from '@codesandbox/components';
import { Icons } from '@codesandbox/template-icons';
import css from '@styled-system/css';
import { useOvermind } from 'app/overmind';
import React, { useEffect } from 'react';

import { EditSummary } from './EditSummary';
import { PenIcon } from './icons';
import { TemplateConfig } from './TemplateConfig';

export const Summary = () => {
  const {
    actions: {
      editor: { frozenUpdated, sessionFreezeOverride },
    },
    state: {
      editor: { sandbox, sessionFrozen },
    },
  } = useOvermind();

  const customTemplate = sandbox.customTemplate;
  const author = sandbox.author;
  const team = sandbox.team;

  useEffect(() => {
    // always freeze it on start
    if (customTemplate) {
      frozenUpdated({ frozen: true });
    }
  }, [customTemplate, frozenUpdated]);

  const updateFrozenState = e => {
    e.preventDefault();
    if (customTemplate) {
      return sessionFreezeOverride({ frozen: !sessionFrozen });
    }

    return frozenUpdated({ frozen: !sandbox.isFrozen });
  };

  const isForked =
    sandbox.isForkedFromSandbox || sandbox.isForkedTemplateSandbox;
  const { url: templateUrl } = sandbox.templateDefinition;

  const [editing, setEditing] = React.useState(false);

  return (
    <>
      <Collapsible
        title={customTemplate ? 'Template Info' : 'Sandbox Info'}
        defaultOpen
      >
        <Element marginBottom={editing ? 10 : 6}>
          {editing ? (
            <EditSummary setEditing={setEditing} />
          ) : (
            <Stack as="section" direction="vertical" gap={2} paddingX={2}>
              <Stack justify="space-between" align="center">
                {customTemplate ? (
                  <Stack gap={2} align="center">
                    <TemplateIcon
                      iconUrl={customTemplate.iconUrl}
                      environment={sandbox.template}
                    />
                    <Text maxWidth={190}>{sandbox.name}</Text>
                  </Stack>
                ) : (
                  <Text maxWidth={190}>{sandbox.name}</Text>
                )}
                <Button
                  variant="link"
                  css={css({ width: 10 })}
                  onClick={() => setEditing(true)}
                >
                  <PenIcon />
                </Button>
              </Stack>

              <Text variant="muted" onClick={() => setEditing(true)}>
                {sandbox.description ||
                  'Add a short description for this sandbox'}
              </Text>

              {sandbox.tags.length ? (
                <Element marginTop={4}>
                  <Tags tags={sandbox.tags} />
                </Element>
              ) : null}
            </Stack>
          )}
        </Element>

        <Stack as="section" direction="vertical" gap={4} paddingX={2}>
          {author ? (
            <Link href={profileUrl(author.username)}>
              <Stack gap={2} align="center" css={{ display: 'inline-flex' }}>
                <Avatar user={author} />
                <Element>
                  <Text variant={team ? 'body' : 'muted'} block>
                    {author.username}
                  </Text>
                  {team && (
                    <Text size={2} marginTop={1} variant="muted">
                      {team.name}
                    </Text>
                  )}
                </Element>
              </Stack>
            </Link>
          ) : null}

          <Stats sandbox={sandbox.get()} />
        </Stack>

        <Divider marginTop={8} marginBottom={4} />

        <List>
          {customTemplate && <TemplateConfig />}
          <ListAction justify="space-between" onClick={updateFrozenState}>
            <Label htmlFor="frozen">Frozen</Label>
            <Switch
              id="frozen"
              onChange={updateFrozenState}
              on={customTemplate ? sessionFrozen : sandbox.isFrozen}
            />
          </ListAction>
          {isForked ? (
            <ListItem justify="space-between">
              <Text>
                {sandbox.isForkedTemplateSandbox ? 'Template' : 'Forked From'}
              </Text>
              <Link
                variant="muted"
                href={sandboxUrl(
                  sandbox.forkedFromSandbox || sandbox.forkedTemplateSandbox
                )}
                target="_blank"
              >
                {getSandboxName(
                  sandbox.forkedFromSandbox || sandbox.forkedTemplateSandbox
                )}
              </Link>
            </ListItem>
          ) : null}
          <ListItem justify="space-between">
            <Text>Environment</Text>
            <Link variant="muted" href={templateUrl} target="_blank">
              {sandbox.template}
            </Link>
          </ListItem>
        </List>
      </Collapsible>
    </>
  );
};

const TemplateIcon = ({ iconUrl, environment }) => {
  const Icon = Icons[iconUrl] || getIcon(environment);
  return <Icon />;
};

const Divider = props => (
  <Element
    as="hr"
    css={css({
      width: '100%',
      border: 'none',
      borderBottom: '1px solid',
      borderColor: 'sideBar.border',
    })}
    {...props}
  />
);
