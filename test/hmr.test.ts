/* eslint-disable @typescript-eslint/no-non-null-assertion,  @typescript-eslint/no-var-requires */

import { join as pathJoin } from 'path';
import assert from 'assert';
import glob from 'globby';
import { promisify } from 'util';
import _rimraf from 'rimraf';
import { promises } from 'fs';
import execa, { Options } from 'execa';
import { killApp, timeout, waitApp } from './lib/child-process';
// import jest from 'jest';

const rimraf = promisify(_rimraf);
const { /*rename,*/ readFile, writeFile } = promises;

const cwd = pathJoin(__dirname, 'fixtures/hmr');
const rel = (relPath: string) => pathJoin(cwd, relPath);
const read = (relPath: string) => readFile(rel(relPath), 'utf-8');

const spawn = (command: string, args: string[], options?: Options) =>
  execa(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    cwd,
    ...(options ? options : {}),
  });

describe('"graphql-let" command', () => {
  // beforeAll(async () => await rename(rel('_gitignore'), rel('.gitignore')));
  beforeAll(async () => await spawn('git', ['checkout', '.'], { cwd }));
  afterAll(async () => await spawn('git', ['checkout', '.'], { cwd }));

  test(
    `generates .d.ts `,
    async () => {
      await rimraf(rel('__generated__'));

      await spawn('yarn', ['install']);

      await spawn('node', ['../../../bin/graphql-let.js']);

      const d = '^__generated__/types';
      const h = '[a-z\\d]+';
      const r1 = await glob('__generated__/types/**', { cwd });
      assert.deepStrictEqual(r1.length, 2);

      // Ensure the initial state
      const [s1, d1] = r1;
      assert(new RegExp(`${d}/__concatedschema__-${h}.d.ts$`).test(s1));
      assert(
        (await read(s1)).includes(`
  export declare type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
      id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
      name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
      status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
      __isTypeOf?: isTypeOfResolverFn<ParentType>;
  };
  export declare type Resolvers<ContextType = any> = {
      Query?: QueryResolvers<ContextType>;
      User?: UserResolvers<ContextType>;
  };
`),
      );
      assert(new RegExp(`${d}/viewer.graphql-${h}.d.ts$`).test(d1));
      assert(
        (await read(d1)).includes(`export declare function useViewerQuery`),
      );

      // Verify loader result
      const app = spawn('yarn', ['webpack-dev-server']);
      await waitApp(8080);

      const loadModule = () => {
        jest.resetModules();
        return require('./fixtures/hmr/dist/main.js');
      };

      const built1 = loadModule();

      assert.ok(
        built1.schema.includes(
          `
type User {
    id: ID!
    name: String!
    status: String!
}
`.trim(),
        ),
      );
      assert.ok(
        built1.document.includes(
          `
export type User = {
   __typename?: 'User',
  id: Scalars['ID'],
  name: Scalars['String'],
  status: Scalars['String'],
};
`.trim(),
        ),
        '"User" type should contain "id", "name" and "status" first.',
      );
      assert.ok(
        built1.document.includes(
          `
export type ViewerQuery = (
  { __typename?: 'Query' }
  & { viewer: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'name'>
  )> }
);
`.trim(),
        ),
        '"ViewerQuery" should only contain "id" and "name" first.',
      );

      // Modify a document to add "status" field
      await writeFile(
        rel('src/viewer.graphql'),
        `
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

      const built2 = loadModule();
      assert.ok(
        built2.document.includes(
          `
export type ViewerQuery = (
  { __typename?: 'Query' }
  & { viewer: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'name' | 'status'>
  )> }
);
`.trim(),
        ),
        'It should now include "status" field by HMR.',
      );

      // Modify schema to add "age" field.
      await writeFile(
        rel('src/type-defs.graphqls'),
        `
type User {
    id: ID!
    name: String!
    status: String!
    age: Int!
}

type Query {
    viewer: User
}
`,
        'utf-8',
      );
      await timeout(10 * 1000);

      const built3 = loadModule();

      assert.ok(
        built3.schema.includes(
          `
type User {
    id: ID!
    name: String!
    status: String!
    age: Int!
}
`.trim(),
        ),
      );
      assert.ok(
        built3.document.includes(
          `
export type User = {
   __typename?: 'User',
  id: Scalars['ID'],
  name: Scalars['String'],
  status: Scalars['String'],
  age: Scalars['Int'],
};
`.trim(),
        ),
        '',
      );
      assert.ok(
        built3.document.includes(
          `
export type ViewerQuery = (
  { __typename?: 'Query' }
  & { viewer: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'name'>
  )> }
);
`.trim(),
        ),
        '',
      );

      // Modify a document again to add "age" field
      await writeFile(
        rel('src/viewer.graphql'),
        `
query Viewer {
    viewer {
        id
        name
        status
        age
    }
}
`,
        'utf-8',
      );
      await timeout(10 * 1000);

      const built4 = loadModule();
      assert.ok(
        built4.document.includes(
          `
export type ViewerQuery = (
  { __typename?: 'Query' }
  & { viewer: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'name' | 'age'>
  )> }
);
`.trim(),
        ),
        '',
      );

      await killApp(app);
    },
    60 * 1000 * 2,
  );
});
