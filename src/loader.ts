import { promises as fsPromises } from "fs";
import { loader } from 'webpack';
import { getOptions } from 'loader-utils';
import path, { join as pathJoin } from 'path';
import { parse as parseYaml } from "yaml";
import createCodegenOpts from "./opts";
import { processCodegen } from "./process-codegen";
import { ConfigTypes } from "./types";

const libDir = path.resolve(__dirname, '..');
const tsxBaseDir = path.join(libDir, '__generated__');

const DEFAULT_CONFIG_FILENAME = '.graphql-let.yml';

const { readFile } = fsPromises;
const graphlqCodegenLoader: loader.Loader = function (this, gqlContent) {

  const options = getOptions(this) as any || {};
  const callback = this.async()!;
  const { resourcePath: gqlFullPath } = this;

  const cwd = process.cwd();
  const configPath = pathJoin(cwd, options.config || DEFAULT_CONFIG_FILENAME);

  const gqlRelPath = path.relative(cwd, gqlFullPath);
  const tsxRelPath = `${gqlRelPath  }.tsx`;
  const tsxFullPath = path.join(tsxBaseDir, tsxRelPath);
  const dtsFullPath = `${ gqlFullPath }.d.ts`;

  (async () => {
    const config = parseYaml(await readFile(configPath, 'utf-8') ) as ConfigTypes;

    const codegenOpts = createCodegenOpts(config);

    // Pretend .tsx for later loaders.
    // babel-loader at least doesn't respond the .graphql extension.
    this.resourcePath = `${ gqlFullPath }.tsx`;

    const tsxContent = await processCodegen(gqlContent.toString(), gqlFullPath, tsxFullPath, dtsFullPath, config, codegenOpts);

    callback(undefined, tsxContent);
  })();
};

export default graphlqCodegenLoader;
