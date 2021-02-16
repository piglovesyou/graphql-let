import { PluginPass } from '@babel/core';
import { relative } from 'path';

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
