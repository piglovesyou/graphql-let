import { deepStrictEqual, ok } from 'assert';
import { join as pathJoin } from 'path';
import createExecContext from "../../src/lib/exec-context";
import { rimraf } from '../../src/lib/file';
import {
  GqlCodegenContext,
  processGqlCompile,
} from '../../src/lib/gql-compile';
import { buildConfig, ConfigTypes } from '../../src/lib/config';
import { createHash } from "../../src/lib/hash";

const dtsRelDir = 'node_modules/@types/graphql-let';
const libRelDir = 'node_modules/graphql-let';

const cwd = pathJoin(__dirname, '../__fixtures/gql-compile');

const config: ConfigTypes = buildConfig({
  schema: 'schema/type-defs.graphqls',
  plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
  documents: [],
  respectGitIgnore: true,
  config: {
    reactApolloVersion: '3',
    withHOC: false,
    withHooks: true,
  },
});

describe('gql-compile', () => {
  beforeAll(async () => {
    await rimraf(pathJoin(cwd, 'node_modules'));
  });
  it(
    'compiles',
    async () => {
      const sourceRelPath = 'pages/index.tsx';
      const schemaHash = '234';
      const gqlContents = [
        `query Viewer {
    viewer {
        id
        name
        status
    }
}`,
      ];
      const codegenContext: GqlCodegenContext = [];
      const oldGqlContentHashes = new Set<string>();
      // const skippedContext: GqlCodegenContext = [];
      const execContext = createExecContext(cwd, config, createHash(JSON.stringify(config)))

      await processGqlCompile(
        execContext,
        // cwd,
        // config,
        dtsRelDir,
        pathJoin(libRelDir, '__generated__'),
        sourceRelPath,
        schemaHash,
        gqlContents,
        {},
        codegenContext,
        oldGqlContentHashes,
        // skippedContext,
      );

      deepStrictEqual(
        codegenContext[0].gqlContent,
        'query Viewer {\n    viewer {\n        id\n        name\n        status\n    }\n}',
      );
      deepStrictEqual(
        codegenContext[0].strippedGqlContent,
        'query Viewer{viewer{id name status}}',
      );
      deepStrictEqual(
        codegenContext[0].gqlContentHash,
        'dd28f9c0ad11900a2654540e86de9cf9fc16f8b4',
      );
      deepStrictEqual(codegenContext[0].sourceRelPath, 'pages/index.tsx');
      ok(
        codegenContext[0].sourceFullPath.endsWith(
          'graphql-let/test/__fixtures/gql-compile/pages/index.tsx',
        ),
      );
      deepStrictEqual(
        codegenContext[0].tsxRelPath,
        'pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.tsx',
      );
      ok(
        codegenContext[0].tsxFullPath.endsWith(
          'graphql-let/test/__fixtures/gql-compile/node_modules/graphql-let/__generated__/pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.tsx',
        ),
      );
      deepStrictEqual(
        codegenContext[0].dtsRelPath,
        'pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.d.ts',
      );
      ok(
        codegenContext[0].dtsFullPath.endsWith(
          'graphql-let/test/__fixtures/gql-compile/node_modules/@types/graphql-let/pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.d.ts',
        ),
      );
      deepStrictEqual(oldGqlContentHashes.size, 0);
    },
    1000 * 1000,
  );
});
