import { NodePath, PluginPass } from '@babel/core';
import * as t from '@babel/types';
import { relative } from 'path';

export type LiteralCallExpressionPaths = [
  NodePath<t.CallExpression> | NodePath<t.TaggedTemplateExpression>,
  string,
][];

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
