import minimist from 'minimist';
import { join as pathJoin } from 'path';
import { printError } from './lib/print';
import { CommandOpts } from './lib/types';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';

const argv = minimist(process.argv.slice(2));
const HELP_TEXT = `Usage: graphql-let [command]

graphql-let         Generates .graphql.d.ts beside all GraphQL documents based on .graphql-let.yml config
graphql-let init    Generates a template of .graphql-let.yml configuration file 
`;

if (argv.help || argv.h) {
  console.info(HELP_TEXT);
  process.exit(0);
}

let task: string;
switch (argv._[0]) {
  case 'gen':
  case undefined:
    task = 'gen';
    break;
  case 'init':
    task = 'init';
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

function command(command: string) {
  const fn = require(`./${command}`).default;
  return Promise.resolve(fn(createOpts()));
}

command(task).catch((err: Error) => {
  printError(err);
  process.exit(1);
});
