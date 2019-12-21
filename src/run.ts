import minimist from 'minimist';
import { join as pathJoin } from 'path';
import { printError } from './print';
import { CommandOpts } from './types';
import { DEFAULT_CONFIG_FILENAME } from './consts';

const argv = minimist(process.argv.slice(2));
const HELP_TEXT = `Usage: graphql-let [command]

graphql-let         Generates .graphql.d.ts beside all GraphQL documents based on .graphql-let.yml config
graphql-let init    Generates a template of .graphql-let.yml configuration file 
`;

if (argv.help || argv.h) {
  console.info(HELP_TEXT);
  process.exit(0);
}

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
    printError(new Error(HELP_TEXT));
    process.exit(1);
    break;
}

function createOpts(): CommandOpts {
  const cwd = process.cwd();
  const configPath = pathJoin(
    cwd,
    argv.config || argv.c || DEFAULT_CONFIG_FILENAME,
  );
  return { cwd, configPath };
}

function run(command: string) {
  const fn = require(`./${command}`).default;
  return Promise.resolve(fn(createOpts()));
}

run(command).catch((err: Error) => {
  printError(err);
  process.exit(1);
});
