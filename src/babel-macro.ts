import { createMacro } from 'babel-plugin-macros';
import { manipulateFromCalleeExpressionsSync } from './ast/manip-from-callee-expressions';
import { getPathsFromState } from './lib2/ast';

const babelMacro = createMacro((params) => {
  const {
    references: { gql: gqlCalleePaths, load: loadCalleePaths },
    state,
  } = params;

  try {
    const { cwd, sourceFullPath, sourceRelPath } = getPathsFromState(state);

    manipulateFromCalleeExpressionsSync(
      cwd,
      gqlCalleePaths,
      loadCalleePaths,
      sourceRelPath,
      sourceFullPath,
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
});

export default babelMacro;
