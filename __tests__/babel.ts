import pluginTester, { TestObject } from 'babel-plugin-tester';
import { join } from 'path';
import myPlugin from '../src/babel-plugin';
import { spawn } from '../src/lib/__tools/child-process';
import { matchPathsAndContents } from '../src/lib/__tools/match-paths-and-contents';

const fixtureBaseDir = join(__dirname, '.' + '__fixtures/babel');

const tests: TestObject[] = ['macro-gql', 'macro-load', 'plugin'].map(
  (name) => {
    const cwd = join(fixtureBaseDir, name);
    return {
      title: name,
      babelOptions: { cwd },
      teardown: async () => {
        await spawn('yarn', ['tsc'], { cwd });
        await matchPathsAndContents(['**/node_modules/**'], cwd);
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
    presets: ['@babel/preset-typescript'],
    plugins: [
      'graphql-let/babel',
      [
        'babel-plugin-module-resolver',
        {
          alias: { 'graphql-let': './' }, // Needed only for tests.
        },
      ],
      'babel-plugin-macros',
    ],
  },
  tests,
});
