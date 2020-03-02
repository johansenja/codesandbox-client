import {
  MutationHookOptions,
  useLazyQuery,
  useMutation,
} from '@apollo/react-hooks';
import { Button } from '@codesandbox/components';
import {
  BookmarkTemplateMutation,
  BookmarkTemplateMutationVariables,
  BookmarkedSandboxInfoQuery,
  BookmarkedSandboxInfoQueryVariables,
  UnbookmarkTemplateMutation,
  UnbookmarkTemplateMutationVariables,
} from 'app/graphql/types';
import { useOvermind } from 'app/overmind';
import React, { useEffect } from 'react';

import { BOOKMARK_TEMPLATE, UNBOOKMARK_TEMPLATE } from './mutations';
import { BOOKMARKED_SANDBOX_INFO } from './queries';

export const BookmarkTemplateButton = () => {
  const {
    state: {
      isLoggedIn,
      editor: { sandbox },
    },
  } = useOvermind();
  const [runQuery, { loading, data }] = useLazyQuery<
    BookmarkedSandboxInfoQuery,
    BookmarkedSandboxInfoQueryVariables
  >(BOOKMARKED_SANDBOX_INFO);

  useEffect(() => {
    if (isLoggedIn) {
      runQuery({
        variables: { sandboxId: sandbox.id },
      });
    }
  }, [isLoggedIn, runQuery, sandbox.id]);

  const bookmarkInfos = data?.sandbox?.customTemplate?.bookmarked || [];

  const config = (
    entityIndex: number = 0
  ): MutationHookOptions<
    BookmarkTemplateMutation | UnbookmarkTemplateMutation,
    BookmarkTemplateMutationVariables | UnbookmarkTemplateMutationVariables
  > => {
    const bookmarkInfo = bookmarkInfos[entityIndex];

    if (!bookmarkInfo) {
      return {};
    }

    return {
      variables: {
        template: sandbox.customTemplate.id,
        team: undefined,
      },
      optimisticResponse: {
        __typename: 'RootMutationType',
        template: {
          __typename: 'Template',
          id: sandbox.customTemplate.id,
          bookmarked: bookmarkInfos.map(b => {
            if (b.entity.id !== bookmarkInfo.entity.id) {
              return b;
            }

            return {
              ...b,
              isBookmarked: !b.isBookmarked,
            };
          }),
        },
      },
    };
  };

  const [bookmark] = useMutation<
    BookmarkTemplateMutation,
    BookmarkTemplateMutationVariables
  >(BOOKMARK_TEMPLATE, config());
  const [unbookmark] = useMutation<
    UnbookmarkTemplateMutation,
    UnbookmarkTemplateMutationVariables
  >(UNBOOKMARK_TEMPLATE, config());

  const handleToggleFollow = (i: number = 0) =>
    bookmarkInfos[i].isBookmarked ? unbookmark(config(i)) : bookmark(config(i));

  return (
    <Button disabled={loading} onClick={() => handleToggleFollow()}>
      {bookmarkInfos[0]?.isBookmarked
        ? `Unbookmark Template`
        : `Bookmark Template`}
    </Button>
  );
};
