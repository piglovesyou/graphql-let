import { promises as fsPromises } from 'fs';
import { loader } from 'webpack';
import { join as pathJoin } from 'path';
import { parse as parseYaml } from 'yaml';
import createCodegenOpts from './create-codegen-opts';
import { createPaths } from './dirs';
import { printInfo } from './print';
import { processCodegen } from './process-codegen';
import { ConfigTypes } from './types';
import { DEFAULT_CONFIG_FILENAME } from './consts';

const { readFile } = fsPromises;
const graphlqCodegenLoader: loader.Loader = function(gqlContent) {
  const callback = this.async()!;

  (async () => {
    const { resourcePath: gqlFullPath, rootContext: userDir, target } = this;
    const configPath = pathJoin(userDir, DEFAULT_CONFIG_FILENAME);
    const config = parseYaml(
      await readFile(configPath, 'utf-8'),
    ) as ConfigTypes;

    const { tsxFullPath, dtsFullPath, dtsRelPath } = createPaths(
      userDir,
      config.generateDir,
      gqlFullPath,
    );

    const codegenOpts = await createCodegenOpts(config, userDir);
    // Pretend .tsx for later loaders.
    // babel-loader at least doesn't respond the .graphql extension.
    this.resourcePath = `${gqlFullPath}.tsx`;

    try {
      const tsxContent = await processCodegen(
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
