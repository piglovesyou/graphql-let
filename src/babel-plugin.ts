import { ConfigAPI, NodePath, PluginObj, PluginPass } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import * as t from '@babel/types';
import { getPathsFromState } from './ast/ast';
import { manipulateFromProgramPath } from './call-expressions/manip-from-program';

export type BabelOptions = {
  configFilePath?: string;
};

export function getGraphQLLetBabelOption(babelOptions: any): BabelOptions {
  for (const { key, options } of babelOptions.plugins || []) {
    if (key.includes('graphql-let/')) {
      return options;
    }
  }
  return {};
}

export const configFunction = (options: BabelOptions = {}): PluginObj<any> => {
  const { configFilePath } = options;

  return {
    visitor: {
      Program(programPath: NodePath<t.Program>, state: PluginPass) {
        const { cwd, sourceFullPath, sourceRelPath } = getPathsFromState(state);

        manipulateFromProgramPath(
          cwd,
          programPath,
          configFilePath,
          sourceRelPath,
          sourceFullPath,
        );
      },
    },
  };
};

export default declare((api: ConfigAPI, options: BabelOptions) => {
  api.assertVersion(7);
  return configFunction(options);
});
