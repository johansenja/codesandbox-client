import { AsyncAction } from 'app/overmind';

export const fetchGitChanges: AsyncAction = async ({ state, effects }) => {
  if (!state.editor.sandbox) {
    return;
  }

  const { id } = state.editor.sandbox;

  state.git.isFetching = true;
  state.git.originalGitChanges = await effects.api.getGitChanges(id);
  state.git.isFetching = false;
};
