import { createMacro } from 'babel-plugin-macros';
import { getPathsFromState } from './call-expressions/ast';
import { manipulateFromCalleeExpressionsSync } from './call-expressions/manip-from-callee-expressions';
import { BabelOptions } from './lib/types';

const babelMacro = createMacro((params) => {
  const {
    references: { gql: gqlCalleePaths, load: loadCalleePaths },
    state,
    config = {},
  } = params;
  const { configFilePath } = config as BabelOptions;

  const { cwd, sourceFullPath, sourceRelPath } = getPathsFromState(state);

  manipulateFromCalleeExpressionsSync(
    cwd,
    gqlCalleePaths,
    loadCalleePaths,
    sourceRelPath,
    sourceFullPath,
    configFilePath,
  );
});

export default babelMacro;
