import traverse from '@babel/traverse';
import { createMacro } from 'babel-plugin-macros';
import { configFunction } from './babel-plugin';

const macro = createMacro((params) => {
  // TODO: Receive options from user?
  const graphqlLetVisitor = configFunction(
    {
      importName: '/macro',
      onlyMatchImportSuffix: true,
    },
    false,
  );
  const { references, state } = params;
  for (const path of references.default) {
    const ancestories = path.getAncestry();
    const programPath = ancestories[ancestories.length - 1];
    traverse(programPath.parent, graphqlLetVisitor.visitor, undefined, state);
  }
});
export default macro;
