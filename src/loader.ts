import { promises as fsPromises } from 'fs';
import { loader } from 'webpack';
import { join as pathJoin, relative as pathRelative } from 'path';
import { parse as parseYaml } from 'yaml';
import getHash from './hash';
import createCodegenOpts from './lib/create-codegen-opts';
import { createPaths } from './lib/paths';
import { printInfo } from './lib/print';
import { codegen } from './lib/codegen';
import { ConfigTypes } from './lib/types';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';

const { readFile } = fsPromises;
const graphlqCodegenLoader: loader.Loader = function(gqlContent) {
  const callback = this.async()!;

  (async () => {
    const { resourcePath: gqlFullPath, rootContext: userDir, target } = this;
    const configPath = pathJoin(userDir, DEFAULT_CONFIG_FILENAME);
    const config = parseYaml(
      await readFile(configPath, 'utf-8'),
    ) as ConfigTypes;

    const hash = getHash(gqlContent);

    const { tsxFullPath, dtsFullPath, dtsRelPath } = createPaths(
      userDir,
      config.generateDir,
      target,
      pathRelative(userDir, gqlFullPath),
      hash,
    );

    const codegenOpts = await createCodegenOpts(config, userDir);
    // Pretend .tsx for later loaders.
    // babel-loader at least doesn't respond the .graphql extension.
    this.resourcePath = `${gqlFullPath}.tsx`;

    try {
      const tsxContent = await codegen(
        gqlContent.toString(),
        gqlFullPath,
        tsxFullPath,
        dtsFullPath,
        config,
        codegenOpts,
      );
      printInfo(`${dtsRelPath} was generated for ${target}.`);
      callback(undefined, tsxContent);
    } catch (e) {
      callback(e);
    }
  })();
};

export default graphlqCodegenLoader;
