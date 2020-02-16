/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { join as pathJoin } from 'path';
import assert from 'assert';
import glob from 'globby';
import { promisify } from 'util';
import _rimraf from 'rimraf';
import { promises } from 'fs';
import execa, { Options } from 'execa';

const rimraf = promisify(_rimraf);
const { rename, readFile } = promises;

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
  beforeAll(async () => await rename(rel('_gitignore'), rel('.gitignore')));
  afterAll(async () => await rename(rel('.gitignore'), rel('_gitignore')));

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
        (await read(d1)).includes(`
  export declare function useViewerQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<ViewerQuery, ViewerQueryVariables>): ApolloReactCommon.QueryResult<ViewerQuery, ViewerQueryVariables>;
`),
      );
    },
    60 * 1000,
  );
});
