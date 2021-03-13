import minimist from 'minimist';
import { basename, dirname, resolve } from 'path';
import { printError } from './lib/print';
import { CommandOpts } from './lib/types';

const argv = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    r: 'require',
  },
});
const HELP_TEXT = `Usage: graphql-let [options] [command]

graphql-let                   Generates .graphql.d.ts beside all GraphQL documents based on .graphql-let.yml config
    --config [FILE]           Generates .graphql.d.ts given a config file
    --require (-r) [MODULE]   Load modules before running. Useful to load env vars by "--require dotenv/config"
    init                      Generates your initial .graphql-let.yml configuration file 
`;

if (argv.help) {
  console.info(HELP_TEXT);
  process.exit(0);
}

if (argv.require) {
  const moduleNames = Array.isArray(argv.require)
    ? argv.require
    : [argv.require];
  for (const name of moduleNames) require(name);
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
  if (argv.config) {
    return {
      cwd: resolve(process.cwd(), dirname(argv.config)),
      configFilePath: basename(argv.config),
    };
  } else {
    const cwd = process.cwd();
    return { cwd };
  }
}

function command(command: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fn = require(`./${command}`).default;
  return Promise.resolve(fn(createOpts()));
}

command(task).catch((err: Error) => {
  printError(err);
  process.exit(1);
});
