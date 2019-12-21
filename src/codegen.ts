import path from 'path';
import { parse as parseYaml } from 'yaml';
import { promises as fsPromises } from 'fs';
import glob from 'fast-glob';
import createCodegenOpts from './create-codegen-opts';
import { getTsxBaseDir } from './dirs';
import { printInfo } from './print';
import { processCodegen } from './process-codegen';
import { CommandOpts, ConfigTypes } from './types';
import { promisify } from 'util';
import _rimraf from 'rimraf';

const rimraf = promisify(_rimraf);
const { readFile } = fsPromises;

export default async function codegen(commandOpts: CommandOpts): Promise<void> {
  const tsxBaseDir = getTsxBaseDir();
  await rimraf(tsxBaseDir);

  const { configPath, cwd } = commandOpts;
  const config = parseYaml(await readFile(configPath, 'utf-8')) as ConfigTypes;

  const codegenOpts = await createCodegenOpts(config, cwd);
  const gqlFullPaths = await glob(path.join(cwd, config.documents));

  for (const gqlFullPath of gqlFullPaths) {
    const gqlRelPath = path.relative(cwd, gqlFullPath);
    const gqlContent = await readFile(gqlFullPath, 'utf-8');
    const tsxRelPath = `${gqlRelPath}.tsx`;
    const tsxFullPath = path.join(tsxBaseDir, tsxRelPath);
    const dtsFullPath = `${gqlFullPath}.d.ts`;
    const dtsRelPath = path.relative(cwd, dtsFullPath);

    await processCodegen(
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
