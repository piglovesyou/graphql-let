import pluginTester, { TestObject } from 'babel-plugin-tester';
import { join } from 'path';
import myPlugin from '../src/babel-plugin';
import { spawn } from '../src/lib/__tools/child-process';

const fixtureBaseDir = join(__dirname, '.' + '__fixtures/babel/suite');

const tests: TestObject[] = ['macro-gql', 'macro-load', 'plugin'].map(
  (name) => {
    const cwd = join(fixtureBaseDir, name);
    return {
      title: name,
      babelOptions: { cwd },
      teardown: async () => {
        await spawn('yarn', ['tsc'], { cwd });
      },
      fixture: join(fixtureBaseDir, name, 'input.ts'),
    };
  },
);

pluginTester({
  title: 'graphql-let',
  plugin: myPlugin,
  snapshot: true,
  babelOptions: {
    plugins: [
      'graphql-let/babel',
      [
        'babel-plugin-module-resolver',
        {
          alias: { 'graphql-let': './' }, // Needed only for tests.
        },
      ],
      'babel-plugin-macros',
      '@babel/plugin-transform-typescript',
    ],
  },
  tests,
});

// const ignoreDirs: string[] = [
//   // 'macro-load'
// ];
//
// beforeAll(async () => {
//   await cleanup(cwd, ['**/node_modules']);
// });
//
// runner(
//   cwd,
//   'gql',
//   // {},
//   {
//     ignoreTasks: ignoreDirs.map((d) => d.split('-').join(' ')),
//   },
//   { sourceType: 'unambiguous' },
// );
//
// test(`Type checking for all fixtures`, async () => {
//   const dirs = await glob(['*/*', ...ignoreDirs.map((d) => `!*/${d}`)], {
//     cwd,
//     onlyDirectories: true,
//     absolute: true,
//   });
//   for (const dir of dirs) await spawn('yarn', ['tsc'], { cwd: dir });
// });
//
// test(`Generated files are okay`, async () => {
//   await matchPathsAndContents(['**/node_modules/**'], cwd);
// });
