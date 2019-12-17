import minimist from 'minimist';
import {join as pathJoin} from 'path';
import { CommandOpts } from "./types";

const argv = minimist(process.argv.slice(2));

// TODO const.ts
const DEFAULT_CONFIG_FILENAME = '.graphql-let.yml';

let command: string;
switch (argv._[0]) {
  case 'codegen':
  case undefined:
    command = 'codegen';
    break;
  case 'init':
    command = 'init';
    break;
  default:
    throw new Error('help text');
}

run(command).catch((err: Error) => console.error(err));

function run(command: string) {
  const fn = require(`./${command}`).default as any;
  return Promise.resolve(fn(createOpts()));
}

function createOpts(): CommandOpts {
  const cwd = process.cwd();
  const configPath = pathJoin(cwd, argv.config || argv.c || DEFAULT_CONFIG_FILENAME);
  return {cwd, configPath}
}
