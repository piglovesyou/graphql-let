/* eslint-disable @typescript-eslint/no-non-null-assertion,  @typescript-eslint/no-var-requires */

import { join as pathJoin } from 'path';
import assert from 'assert';
import glob from 'globby';
import { promisify } from 'util';
import _rimraf from 'rimraf';
import { promises } from 'fs';
import execa, { Options } from 'execa';
import { killApp, timeout, waitApp } from './lib/child-process';

const rimraf = promisify(_rimraf);
const { readFile, writeFile } = promises;

const cwd = pathJoin(__dirname, 'fixtures/hmr');
const rel = (relPath: string) => pathJoin(cwd, relPath);
const read = (relPath: string) => readFile(rel(relPath), 'utf-8');

// TODO: Test loader value
// const loadModule = () => {
//   jest.resetModules();
//   return require('./fixtures/hmr/dist/main.js');
// };

const spawn = (command: string, args: string[], options?: Options) =>
  execa(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    cwd,
    ...(options ? options : {}),
  });

describe('HMR', () => {
  beforeAll(async () => await spawn('git', ['checkout', '.'], { cwd }));
  afterAll(async () => await spawn('git', ['checkout', '.'], { cwd }));

  test(
    `should effect to both schema and documents properly`,
    async () => {
      await rimraf(rel('__generated__'));

      await spawn('yarn', ['install']);

      await spawn('node', ['../../../bin/graphql-let.js']);

      const d = '^__generated__/types';
      const h = '[a-z\\d]+';

      const ensureOutputDts = async () => {
        const globResults = await glob('__generated__/types/**', { cwd });
        assert.deepStrictEqual(globResults.length, 2);
        const [schemaDtsPath, documentDtsPath] = globResults.sort();
        assert.ok(
          new RegExp(`${d}/__concatedschema__-${h}.d.ts$`).test(schemaDtsPath),
          `${schemaDtsPath} is something wrong.`,
        );
        assert.ok(
          new RegExp(`${d}/viewer.graphql-${h}.d.ts$`).test(documentDtsPath),
          `${documentDtsPath} is something wrong.`,
        );
        return {
          schemaDtsPath,
          schema: await read(schemaDtsPath),
          documentDtsPath,
          document: await read(documentDtsPath),
        };
      };

      /************************************************************************
       * Ensure the initial state
       */
      const result1 = await ensureOutputDts();
      assert.ok(
        result1.schema.includes(`
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
  };
`),
        `${result1.schema} is something wrong`,
      );
      assert.ok(
        result1.document.includes(`
  export type ViewerQuery = ({
      __typename?: 'Query';
  } & {
      viewer: Maybe<({
          __typename?: 'User';
      } & Pick<User, 'id' | 'name'>)>;
  });
`),
        `${result1.document} is something wrong`,
      );

      /************************************************************************
       * Start dev server
       */
      const app = spawn('yarn', ['webpack-dev-server']);
      await waitApp(8080);

      /************************************************************************
       * Verify initial loader behavior
       */
      const result2 = await ensureOutputDts();
      assert.deepStrictEqual(
        result2.schemaDtsPath,
        result1.schemaDtsPath,
        'Initially Loader should respect cache.',
      );
      assert.deepStrictEqual(
        result2.schema,
        result1.schema,
        'Initially Loader should respect cache.',
      );
      assert.deepStrictEqual(
        result2.documentDtsPath,
        result1.documentDtsPath,
        'Initially Loader should respect cache.',
      );
      assert.deepStrictEqual(
        result2.document,
        result1.document,
        'Initially Loader should respect cache.',
      );

      // const built1 = loadModule();
      //       assert.ok(
      //         built1.schema.includes(
      //           `
      // type User {
      //     id: ID!
      //     name: String!
      //     status: String!
      // }
      // `.trim(),
      //         ),
      //       );
      //       assert.ok(
      //         built1.document.includes(
      //           `
      // export type User = {
      //    __typename?: 'User',
      //   id: Scalars['ID'],
      //   name: Scalars['String'],
      //   status: Scalars['String'],
      // };
      // `.trim(),
      //         ),
      //         '"User" type should contain "id", "name" and "status" first.',
      //       );
      //       assert.ok(
      //         built1.document.includes(
      //           `
      // export type ViewerQuery = (
      //   { __typename?: 'Query' }
      //   & { viewer: Maybe<(
      //     { __typename?: 'User' }
      //     & Pick<User, 'id' | 'name'>
      //   )> }
      // );
      // `.trim(),
      //         ),
      //         '"ViewerQuery" should only contain "id" and "name" first.',
      //       );

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
      await timeout(10 * 1000);
      const result3 = await ensureOutputDts();
      assert.deepStrictEqual(
        result3.schemaDtsPath,
        result1.schemaDtsPath,
        'Schema should not be effected by document modification.',
      );
      assert.deepStrictEqual(
        result3.schema,
        result1.schema,
        'Schema should not be effected by document modification.',
      );
      assert.notDeepStrictEqual(
        result3.documentDtsPath,
        result1.documentDtsPath,
        'Document should be renewed.',
      );
      assert.notDeepStrictEqual(
        result3.document,
        result1.document,
        'Document should be renewed.',
      );
      assert.ok(
        result3.document.includes(`
  export type ViewerQuery = ({
      __typename?: 'Query';
  } & {
      viewer: Maybe<({
          __typename?: 'User';
      } & Pick<User, 'id' | 'name' | 'status'>)>;
  });
`),
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
      await timeout(10 * 1000);
      const result4 = await ensureOutputDts();
      assert.notDeepStrictEqual(
        result4.schemaDtsPath,
        result3.schemaDtsPath,
        'Schema should be renewed.',
      );
      assert.notDeepStrictEqual(
        result4.schema,
        result3.schema,
        'Schema should be renewed.',
      );
      assert.notDeepStrictEqual(
        result4.documentDtsPath,
        result3.documentDtsPath,
        'Document should be renewed.',
      );
      assert.notDeepStrictEqual(
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
        result4.document.includes(`
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
      age: Scalars['Int'];
  };
`),
      );

      await killApp(app);
    },
    60 * 1000 * 2,
  );
});
