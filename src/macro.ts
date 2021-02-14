import { NodePath, types as t } from '@babel/core';
import traverse from '@babel/traverse';
import { createMacro } from 'babel-plugin-macros';
import { configFunction } from './babel-plugin';

function getProgramNode(n: NodePath<any>): NodePath<t.Program> {
  if (n.parentPath) return getProgramNode(n.parentPath);
  return n;
}

const macro = createMacro((params) => {
  // TODO: Receive options from user?
  const graphqlLetVisitor = configFunction(
    {
      importName: '/macro',
      onlyMatchImportSuffix: true,
    },
    false,
  );
  const {
    references,
    // babel: { traverse, parseSync },
    state,
  } = params;
  references.default.forEach((node) => {
    const ancestories = node.getAncestry();
    const programPath = ancestories[ancestories.length - 1];
    traverse(programPath.parent, graphqlLetVisitor.visitor, undefined, state);
  });
});
export default macro;
