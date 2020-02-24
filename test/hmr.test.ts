/* eslint-disable @typescript-eslint/no-non-null-assertion,  @typescript-eslint/no-var-requires */

import { join as pathJoin } from 'path';
import assert from 'assert';
import glob from 'globby';
import execa from 'execa';
import waitOn from 'wait-on';
import { killApp } from './lib/child-process';
import retryable from './lib/retryable';
import { readFile, writeFile, rimraf } from './lib/file';

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

const cwd = pathJoin(__dirname, 'fixtures/hmr');
const rel = (relPath: string) => pathJoin(cwd, relPath);
const read = (relPath: string) => readFile(rel(relPath));
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

const d = '^__generated__/types';
const h = '[a-z\\d]+';
const ensureOutputDts = async (message: string): Promise<ResultType> => {
  const globResults = await glob('__generated__/types/**', { cwd });
  assert.equal(
    globResults.length,
    2,
    `"${JSON.stringify(globResults)}" is something wrong. ${message}`,
  );
  const [schemaDtsPath, documentDtsPath] = globResults.sort();
  assert.ok(
    new RegExp(`${d}/__concatedschema__-${h}.d.ts$`).test(schemaDtsPath),
    `${schemaDtsPath} is something wrong. ${message}`,
  );
  assert.ok(
    new RegExp(`${d}/viewer.graphql-${h}.d.ts$`).test(documentDtsPath),
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

  beforeAll(async () => await spawn('yarn', ['install']), 60 * 1000);
  beforeEach(async () => {
    await restoreFixtures();
    await rimraf(rel('__generated__'));
    await spawn('node', ['../../../bin/graphql-let.js']);
  }, 60 * 1000);
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
      assert.ok(
        result1.schema.includes(
          `
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
  };
`,
        ),
        `"${result1.schema}" is something wrong`,
      );
      assert.ok(
        result1.document.includes(
          `
  export type ViewerQuery = ({
      __typename?: 'Query';
  } & {
      viewer: Maybe<({
          __typename?: 'User';
      } & Pick<User, 'id' | 'name'>)>;
  });
`,
        ),
        `${result1.document} is something wrong`,
      );

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
      assert.equal(
        result2.schemaDtsPath,
        result1.schemaDtsPath,
        'Initially Loader should respect cache.',
      );
      assert.equal(
        result2.schema,
        result1.schema,
        'Initially Loader should respect cache.',
      );
      assert.equal(
        result2.documentDtsPath,
        result1.documentDtsPath,
        'Initially Loader should respect cache.',
      );
      assert.equal(
        result2.document,
        result1.document,
        'Initially Loader should respect cache.',
      );

      /************************************************************************
       * Verify HMR on document modification
       */
      await writeFile(
        rel('src/viewer.graphql'),
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

      let result3: ResultType;
      await retryable(
        async () => {
          result3 = await ensureOutputDts(
            'Verify HMR on document modification',
          );
          assert.equal(
            result3.schemaDtsPath,
            result1.schemaDtsPath,
            'Schema should not be effected by document modification.',
          );
          assert.equal(
            result3.schema,
            result1.schema,
            'Schema should not be effected by document modification.',
          );
          assert.notEqual(
            result3.documentDtsPath,
            result1.documentDtsPath,
            'Document should be renewed.',
          );
          assert.notEqual(
            result3.document,
            result1.document,
            'Document should be renewed.',
          );
          assert.ok(
            result3.document.includes(
              `
  export type ViewerQuery = ({
      __typename?: 'Query';
  } & {
      viewer: Maybe<({
          __typename?: 'User';
      } & Pick<User, 'id' | 'name' | 'status'>)>;
  });
`,
            ),
          );
        },
        1000,
        WAIT_FOR_HMR,
      );

      /************************************************************************
       * Verify HMR on schema modification - add "age" field
       */
      await writeFile(
        rel('src/type-defs.graphqls'),
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
      await retryable(
        async () => {
          const result4 = await ensureOutputDts(
            'Verify HMR on schema modification - add "age" field',
          );
          assert.notEqual(
            result4.schemaDtsPath,
            result3.schemaDtsPath,
            'Schema should be renewed.',
          );
          assert.notEqual(
            result4.schema,
            result3.schema,
            'Schema should be renewed.',
          );
          assert.notEqual(
            result4.documentDtsPath,
            result3.documentDtsPath,
            'Document should be renewed.',
          );
          assert.notEqual(
            result4.document,
            result3.document,
            'Document should be renewed.',
          );
          assert.ok(
            result4.schema.includes(
              `
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
      age: Scalars['Int'];
  };
`,
            ),
          );
          assert.ok(
            result4.document.includes(
              `
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
      age: Scalars['Int'];
  };
`,
            ),
          );
        },
        1000,
        WAIT_FOR_HMR,
      );
    },
    5 * 60 * 1000,
  );

  test(
    'should recover after GraphQL Error properly',
    async () => {
      let stderrContent = '';

      /************************************************************************
       * Start dev server
       */
      app = spawn('yarn', ['webpack-dev-server'], { stderr: undefined });
      app.stderr!.on('data', err => (stderrContent += String(err)));
      await waitOn({
        resources: ['http://localhost:3000/main.js'],
        timeout: 60 * 1000,
      });

      /************************************************************************
       * Make an error to write wrong GraphQL schema
       */

      await writeFile(
        rel('src/type-defs.graphqls'),
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

      await retryable(
        async () => {
          assert.ok(
            stderrContent.includes(
              'GraphQLDocumentError: Cannot query field "name" on type "User".',
            ),
          );
          const globResults = await glob('__generated__/types/**', { cwd });
          assert.strictEqual(globResults.length, 0);
        },
        1000,
        60 * 1000,
      );
      stderrContent = '';

      /************************************************************************
       * Correcting GraphQL schema should re-generate d.ts properly
       */

      await writeFile(
        rel('src/type-defs.graphqls'),
        `
type User {
    id: ID!
    name: String!
    status: String!
}

type Query {
    viewer: User
}
      `.trim(),
        'utf-8',
      );

      await retryable(
        async () => {
          const result = await ensureOutputDts('');
          assert.ok(
            result.schema.includes(
              `
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
  };
`,
            ),
            `"${result.schema}" is something wrong`,
          );
          assert.ok(
            result.document.includes(
              `
  export type ViewerQuery = ({
      __typename?: 'Query';
  } & {
      viewer: Maybe<({
          __typename?: 'User';
      } & Pick<User, 'id' | 'name'>)>;
  });
`,
            ),
            `${result.document} is something wrong`,
          );
        },
        1000,
        30 * 1000,
      );
    },
    5 * 60 * 1000,
  );
});
