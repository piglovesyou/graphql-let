import path from 'path';
import { parse as parseYaml } from 'yaml';
import { promises as fsPromises } from 'fs';
import glob from 'fast-glob';
import createCodegenOpts from './lib/create-codegen-opts';
import { createPaths } from './lib/paths';
import { printInfo } from './lib/print';
import { codegen } from './lib/codegen';
import { CommandOpts, ConfigTypes } from './lib/types';
import { promisify } from 'util';
import _rimraf from 'rimraf';
import unixify from 'unixify';

const rimraf = promisify(_rimraf);
const { readFile } = fsPromises;

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  const { configPath, cwd } = commandOpts;
  const config = parseYaml(await readFile(configPath, 'utf-8')) as ConfigTypes;

  await rimraf(path.join(cwd, config.generateDir));

  const codegenOpts = await createCodegenOpts(config, cwd);
  // Taking care of Windows
  const gqlFullGlob = unixify(path.join(cwd, config.documents));
  const gqlFullPaths = await glob(gqlFullGlob);

  for (const gqlFullPath of gqlFullPaths) {
    const gqlContent = await readFile(gqlFullPath, 'utf-8');

    const { tsxFullPath, dtsFullPath, dtsRelPath } = createPaths(
      cwd,
      config.generateDir,
      'command',
      gqlFullPath,
    );

    await codegen(
      gqlContent,
      gqlFullPath,
      tsxFullPath,
      dtsFullPath,
      config,
      codegenOpts,
    );

    printInfo(`${dtsRelPath} was generated.`);
  }
}
