/* eslint-disable @typescript-eslint/no-non-null-assertion,  @typescript-eslint/no-var-requires */

import { notStrictEqual, ok, strictEqual } from 'assert';
import execa from 'execa';
import glob from 'globby';
import { join as pathJoin } from 'path';
import waitOn from 'wait-on';
import { killApp, timeout } from '../__tools/child-process';
import { cleanup, readFile, writeFile } from '../__tools/file';
import retryable from '../__tools/retryable';

// TODO: Test loader value
// const loadModule = () => {
//   jest.resetModules();
//   return require('./fixtures/hmr/dist/main.js');
// };

type ResultType = {
  schemaDtsPath: string;
  schema: string;
  documentDtsPath: string;
  document: string;
};

const WAIT_FOR_HMR = 90 * 1000;

const cwd = pathJoin(__dirname, '__fixtures/hmr');
const abs = (relPath: string) => pathJoin(cwd, relPath);
const read = (relPath: string) => readFile(abs(relPath));
const spawn = (
  command: string,
  args: string[],
  opts?: execa.CommonOptions<'utf-8'>,
) =>
  execa(command, args, {
    cwd,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    ...opts,
  });
const restoreFixtures = () => spawn('git', ['checkout', '.']);

const ensureOutputDts = async (message: string): Promise<ResultType> => {
  const globResults = await glob(['**/*.graphql.d.ts', '**/*.graphqls.d.ts'], {
    cwd,
  });
  strictEqual(
    globResults.length,
    2,
    `"${JSON.stringify(globResults)}" is something wrong. ${message}`,
  );
  const [schemaDtsPath, documentDtsPath] = globResults.sort();
  strictEqual(
    schemaDtsPath,
    'src/type-defs.graphqls.d.ts',
    `${schemaDtsPath} is something wrong. ${message}`,
  );
  strictEqual(
    documentDtsPath,
    'src/viewer.graphql.d.ts',
    `${documentDtsPath} is something wrong. ${message}`,
  );
  return {
    schemaDtsPath: schemaDtsPath,
    schema: await read(schemaDtsPath),
    documentDtsPath: documentDtsPath,
    document: await read(documentDtsPath),
  };
};

describe('HMR', () => {
  let app: execa.ExecaChildProcess;

  beforeEach(async () => {
    await restoreFixtures();
    await cleanup(cwd);
    await spawn('node', ['../../../bin/graphql-let.js']);
  });
  afterEach(async () => {
    await killApp(app);
    await restoreFixtures();
  });

  test(
    `should effect to both schema and documents properly`,
    async () => {
      /************************************************************************
       * Ensure the command result
       */
      const result1 = await ensureOutputDts('Ensure the initial state');
      expect(result1).toMatchSnapshot();

      /************************************************************************
       * Start dev server
       */
      app = spawn('yarn', ['webpack-dev-server']);
      await waitOn({
        resources: ['http://localhost:3000/main.js'],
        timeout: 60 * 1000,
      });

      /************************************************************************
       * Verify initial loader behavior
       */
      const result2 = await ensureOutputDts('Verify initial loader behavior');
      expect(result2).toMatchObject(result1);

      /************************************************************************
       * Verify HMR on document modification
       */
      await timeout(3 * 1000);
      await writeFile(
        abs('src/viewer.graphql'),
        `
# Add "status" field for testing
query Viewer {
    viewer {
        id
        name
        status
    }
}
`,
        'utf-8',
      );
      await timeout(3 * 1000);

      let result3: ResultType;
      await retryable(
        async () => {
          result3 = await ensureOutputDts(
            'Verify HMR on document modification',
          );
          strictEqual(
            result3.schemaDtsPath,
            result1.schemaDtsPath,
            'Schema should not be effected by document modification.',
          );
          strictEqual(
            result3.schema,
            result1.schema,
            'Schema should not be effected by document modification.',
          );
          notStrictEqual(
            result3.document,
            result1.document,
            'Document should be renewed.',
          );
        },
        1000,
        WAIT_FOR_HMR,
      );
      expect(result3!).toMatchSnapshot();

      /************************************************************************
       * Verify HMR on schema modification - add "age" field
       */
      await timeout(3 * 1000);
      await writeFile(
        abs('src/type-defs.graphqls'),
        `
# Add "age" field for testing
type User {
    id: ID!
    name: String!
    status: String!
    age: Int!
}

type Query {
    viewer: User
}
`.trim(),
        'utf-8',
      );
      await timeout(3 * 1000);

      let result4: ResultType;
      await retryable(
        async () => {
          result4 = await ensureOutputDts(
            'Verify HMR on schema modification - add "age" field',
          );
          notStrictEqual(
            result4.schema,
            result3.schema,
            'Schema should be renewed.',
          );
          notStrictEqual(
            result4.document,
            result3.document,
            'Document should be renewed.',
          );
        },
        1000,
        WAIT_FOR_HMR,
      );
      expect(result4!).toMatchSnapshot();
    },
    5 * 60 * 1000,
  );

  test(
    'should recover after GraphQL Error properly',
    async () => {
      const initialSchemaContent = await readFile(
        abs('src/type-defs.graphqls'),
      );

      /************************************************************************
       * Start dev server
       */
      let stdoutContent = '';
      let stderrContent = '';
      app = spawn('yarn', ['webpack-dev-server'], {
        stdout: undefined,
        stderr: undefined,
      });
      app.stdout!.on('data', (data) => (stdoutContent += String(data)));
      app.stderr!.on('data', (err) => (stderrContent += String(err)));
      await waitOn({
        resources: ['http://localhost:3000/main.js'],
        timeout: 60 * 1000,
      });

      /************************************************************************
       * Make an error by writing wrong GraphQL schema
       */

      await timeout(3 * 1000);
      await writeFile(
        abs('src/type-defs.graphqls'),
        `
type User {
    id: ID!
#    name: String!
#    status: String!
}

type Query {
    viewer: User
}
`.trim(),
        'utf-8',
      );
      await timeout(3 * 1000);

      await retryable(
        async () => {
          expect(stderrContent).toBeTruthy();
          const globResults = await glob('__generated__/types/**', { cwd });
          strictEqual(globResults.length, 0);
        },
        1000,
        60 * 1000,
      );
      ok(
        stderrContent.includes(
          'GraphQLDocumentError: Cannot query field "name" on type "User".',
        ),
      );

      /************************************************************************
       * Restoring schema should recover the error state and re-generate d.ts
       */

      stderrContent = '';
      stdoutContent = '';
      await timeout(3 * 1000);
      await writeFile(
        abs('src/type-defs.graphqls'),
        initialSchemaContent,
        'utf-8',
      );
      await timeout(3 * 1000);

      await retryable(
        async () => {
          expect(stderrContent).toBeFalsy();
          ok(stdoutContent.trim().endsWith('Compiled successfully.'));
        },
        1000,
        30 * 1000,
      );
    },
    5 * 60 * 1000,
  );
});
