import getIcon from '@codesandbox/common/lib/templates/icons';
import { Element, ListAction, Text } from '@codesandbox/components';
import { ColorIcons as Icons } from '@codesandbox/template-icons';
import { useOvermind } from 'app/overmind';
import React, { FunctionComponent, useState } from 'react';
import { Popover, PopoverDisclosure, usePopoverState } from 'reakit/Popover';
import styled, { css } from 'styled-components';

const buttonStyles = css`
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
`;

export const IconButton = styled.button`
  ${buttonStyles}
`;

export const IconWrapper = styled(Popover)`
  ${({ theme }) => css`
    z-index: 12;
    padding: ${theme.space[3]}px;
    background: ${theme.colors.sideBar.background};
  `};
`;

export const IconList = styled.ul`
  list-style: none;
  display: grid;
  padding: ${props => props.theme.space[2]}px;
  margin: 0;
  grid-template-columns: repeat(7, 24px);
  grid-gap: 10px;
  border: 1px solid ${props => props.theme.colors.sideBar.border};

  li {
    cursor: pointer;
  }
`;

const OpenPopover = styled(PopoverDisclosure)`
  ${buttonStyles}
  color: inherit;
  width: 100%;
`;

export const TemplateConfig: FunctionComponent = () => {
  const {
    actions: {
      workspace: { editTemplate },
    },
    state: {
      editor: { sandbox },
    },
  } = useOvermind();
  const iconPopover = usePopoverState({
    placement: 'top',
  });
  const [selectedIcon, setSelectedIcon] = useState(
    sandbox.customTemplate.iconUrl || ''
  );

  const DefaultIcon = getIcon(sandbox.template);

  const setIcon = (key: string) => {
    setSelectedIcon(key);
    iconPopover.hide();
    editTemplate({ ...sandbox.customTemplate, iconUrl: key });
  };
  const TemplateIcon = Icons[selectedIcon];

  return (
    <OpenPopover {...iconPopover}>
      <ListAction justify="space-between" gap={2}>
        <Text>Template Icon</Text>
        <Element>
          <Element>
            {selectedIcon && TemplateIcon ? (
              <TemplateIcon width={24} />
            ) : (
              <DefaultIcon width={24} />
            )}
          </Element>
          <IconWrapper
            aria-label="Choose an Icon"
            hideOnClickOutside
            hideOnEsc
            {...iconPopover}
          >
            <IconList>
              {Object.keys(Icons).map((i: string) => {
                const TemplateIconMap = Icons[i];
                return (
                  // eslint-disable-next-line
                  <li onClick={() => setIcon(i)} role="button" tabIndex={0}>
                    <IconButton>
                      <TemplateIconMap width={24} />
                    </IconButton>
                  </li>
                );
              })}
            </IconList>
          </IconWrapper>
        </Element>
      </ListAction>
    </OpenPopover>
  );
};
