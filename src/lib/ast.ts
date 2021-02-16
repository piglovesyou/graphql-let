import { NodePath, PluginPass } from '@babel/core';
import * as t from '@babel/types';
import { relative } from 'path';
import { printError } from './print';

export type LiteralCallExpressionPaths = [
  NodePath<t.CallExpression> | NodePath<t.TaggedTemplateExpression>,
  string,
][];

export type PendingDeletion = {
  specifier:
    | t.ImportSpecifier
    | t.ImportDefaultSpecifier
    | t.ImportNamespaceSpecifier;
  path: NodePath<t.ImportDeclaration>;
}[];

export type VisitLiteralCallResults = {
  pendingDeletion: PendingDeletion;
  literalCallExpressionPaths: LiteralCallExpressionPaths;
  hasError: boolean;
};

export function getPathsFromState(state: PluginPass) {
  const { cwd } = state;
  const sourceFullPath = state.file.opts.filename;
  if (!sourceFullPath)
    throw new Error(
      `Couldn't find source path to traversal. Check "${JSON.stringify(
        state,
      )}"`,
    );

  const sourceRelPath = relative(cwd, sourceFullPath);
  return { cwd, sourceFullPath, sourceRelPath };
}

export function getArgumentString(path: NodePath): string {
  let value = '';
  path.traverse({
    TemplateLiteral(path: NodePath<t.TemplateLiteral>) {
      if (path.node.quasis.length !== 1) {
        printError(
          new Error(
            `TemplateLiteral of the argument must not contain arguments.`,
          ),
        );
        return;
      }
      value = path.node.quasis[0].value.raw;
    },
    StringLiteral(path: NodePath<t.StringLiteral>) {
      value = path.node.value;
    },
  });
  if (!value) printError(new Error(`Argument Check the argument.`));
  return value;
}

export function visitFromCallExpressionPaths(
  gqlCallExpressionPaths: NodePath<t.CallExpression>[],
) {
  const literalCallExpressionPaths: LiteralCallExpressionPaths = [];
  for (const path of gqlCallExpressionPaths) {
    const value = getArgumentString(path.parentPath);
    if (value) literalCallExpressionPaths.push([path, value]);
  }
  return literalCallExpressionPaths;
}
