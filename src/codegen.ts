import path from "path";
import { parse as parseYaml } from 'yaml';
import { promises as fsPromises } from "fs";
import glob from 'fast-glob';
import createCodegenOpts from "./opts";
import { processCodegen } from "./process-codegen";
import { CommandOpts, ConfigTypes } from "./types";

const { readFile } = fsPromises;

const libDir = path.resolve(__dirname, '..');
const tsxBaseDir = path.join(libDir, '__generated__');

export default async function codegen(commandOpts: CommandOpts) {
  const { configPath, cwd } = commandOpts;
  const config = parseYaml(await readFile(configPath, 'utf-8') ) as ConfigTypes;

  const codegenOpts = createCodegenOpts(config);

  const gqlFullPaths = await glob(path.join(cwd, config.documents));
  for (const gqlFullPath of gqlFullPaths) {
    const gqlRelPath = path.relative(cwd, gqlFullPath);
    const gqlContent = await readFile(gqlFullPath, 'utf-8');
    const tsxRelPath = `${gqlRelPath  }.tsx`;
    const tsxFullPath = path.join(tsxBaseDir, tsxRelPath);
    const dtsFullPath = `${ gqlFullPath }.d.ts`;

    await processCodegen(gqlContent, gqlFullPath, tsxFullPath, dtsFullPath, config, codegenOpts);

    console.info(`${dtsFullPath} is generated`)
  }
}
