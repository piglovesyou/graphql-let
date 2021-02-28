import { createMacro } from 'babel-plugin-macros';
import { getPathsFromState } from './call-expressions/ast';
import { manipulateFromCalleeExpressionsSync } from './call-expressions/manip-from-callee-expressions';

const babelMacro = createMacro((params) => {
  const {
    references: { gql: gqlCalleePaths, load: loadCalleePaths },
    state,
  } = params;

  const { cwd, sourceFullPath, sourceRelPath } = getPathsFromState(state);

  manipulateFromCalleeExpressionsSync(
    cwd,
    gqlCalleePaths,
    loadCalleePaths,
    sourceRelPath,
    sourceFullPath,
  );
});

export default babelMacro;
