/* eslint-disable @typescript-eslint/no-non-null-assertion,  @typescript-eslint/no-var-requires */

import { join as pathJoin } from 'path';
import assert from 'assert';
import glob from 'globby';
import { promisify } from 'util';
import _rimraf from 'rimraf';
import { promises } from 'fs';
import execa, { Options } from 'execa';
import { killApp, timeout, waitApp } from './lib/child-process';

// TODO: Test loader value
// const loadModule = () => {
//   jest.resetModules();
//   return require('./fixtures/hmr/dist/main.js');
// };

const rimraf = promisify(_rimraf);
const { readFile, writeFile } = promises;

const cwd = pathJoin(__dirname, 'fixtures/hmr');
const rel = (relPath: string) => pathJoin(cwd, relPath);
const read = (relPath: string) => readFile(rel(relPath), 'utf-8');

// Normalize file content for Windows
Object.defineProperty(String.prototype, 'n', {
  get(): string {
    return this.replace(/\r\n/g, '\n').trim();
  },
});

const spawn = (command: string, args: string[], options?: Options) =>
  execa(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    cwd,
    ...(options ? options : {}),
  });

describe('HMR', () => {
  let app: any;

  beforeAll(async () => await spawn('git', ['checkout', '.'], { cwd }));
  afterAll(async () => {
    await spawn('git', ['checkout', '.'], { cwd });

    await killApp(app);
  });

  test(
    `should effect to both schema and documents properly`,
    async () => {
      await rimraf(rel('__generated__'));

      await spawn('yarn', ['install']);

      await spawn('node', ['../../../bin/graphql-let.js']);

      const d = '^__generated__/types';
      const h = '[a-z\\d]+';

      const ensureOutputDts = async (message: string) => {
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
          schemaDtsPath: schemaDtsPath.n,
          schema: await read(schemaDtsPath),
          documentDtsPath: documentDtsPath.n,
          document: await read(documentDtsPath),
        };
      };

      /************************************************************************
       * Ensure the initial state
       */
      const result1 = await ensureOutputDts('Ensure the initial state');
      assert.ok(
        result1.schema.n.includes(
          `
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
  };
`.n,
        ),
        `"${result1.schema}" is something wrong`,
      );
      assert.ok(
        result1.document.n.includes(
          `
  export type ViewerQuery = ({
      __typename?: 'Query';
  } & {
      viewer: Maybe<({
          __typename?: 'User';
      } & Pick<User, 'id' | 'name'>)>;
  });
`.n,
        ),
        `${result1.document} is something wrong`,
      );

      /************************************************************************
       * Start dev server
       */
      app = spawn('yarn', ['webpack-dev-server']);
      await waitApp(8080);

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
      await timeout(60 * 1000);
      const result3 = await ensureOutputDts(
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
        result3.document.n.includes(
          `
  export type ViewerQuery = ({
      __typename?: 'Query';
  } & {
      viewer: Maybe<({
          __typename?: 'User';
      } & Pick<User, 'id' | 'name' | 'status'>)>;
  });
`.n,
        ),
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
      await timeout(60 * 1000);
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
        result4.schema.n.includes(
          `
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
      age: Scalars['Int'];
  };
`.n,
        ),
      );
      assert.ok(
        result4.document.n.includes(
          `
  export type User = {
      __typename?: 'User';
      id: Scalars['ID'];
      name: Scalars['String'];
      status: Scalars['String'];
      age: Scalars['Int'];
  };
`.n,
        ),
      );
    },
    60 * 1000 * 100,
  );
});
