import { deepStrictEqual, ok } from 'assert';
import { join as pathJoin } from 'path';
import slash from 'slash';
import { rimraf } from '../../src/lib/file';
import {
  GqlCodegenContext,
  processGqlCompile,
} from '../../src/lib/gql-compile';
import { buildConfig, ConfigTypes } from '../../src/lib/config';
import { readFile } from '../__tools/file';

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

      await processGqlCompile(
        cwd,
        config,
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

      deepStrictEqual(codegenContext.length, 1);
      const [
        {
          gqlContent,
          strippedGqlContent,
          gqlContentHash,
          sourceFullPath,
          tsxRelPath,
          tsxFullPath,
          dtsRelPath,
          dtsFullPath,
        },
      ] = codegenContext;
      deepStrictEqual(
        gqlContent,
        'query Viewer {\n    viewer {\n        id\n        name\n        status\n    }\n}',
      );
      deepStrictEqual(
        strippedGqlContent,
        'query Viewer{viewer{id name status}}',
      );
      deepStrictEqual(
        gqlContentHash,
        'dd28f9c0ad11900a2654540e86de9cf9fc16f8b4',
      );
      deepStrictEqual(sourceRelPath, 'pages/index.tsx');

      ok(
        slash(sourceFullPath).endsWith(
          'graphql-let/test/__fixtures/gql-compile/pages/index.tsx',
        ),
        sourceFullPath,
      );

      deepStrictEqual(
        slash(tsxRelPath),
        'pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.tsx',
      );
      ok(
        slash(tsxFullPath).endsWith(
          'graphql-let/test/__fixtures/gql-compile/node_modules/graphql-let/__generated__/pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.tsx',
        ),
        tsxFullPath,
      );
      expect(await readFile(tsxFullPath)).toMatchSnapshot(tsxFullPath);

      deepStrictEqual(
        slash(dtsRelPath),
        'pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.d.ts',
      );
      ok(
        slash(dtsFullPath).endsWith(
          'graphql-let/test/__fixtures/gql-compile/node_modules/@types/graphql-let/pages/index-dd28f9c0ad11900a2654540e86de9cf9fc16f8b4.d.ts',
        ),
        dtsFullPath,
      );
      expect(await readFile(dtsFullPath)).toMatchSnapshot(dtsFullPath);

      deepStrictEqual(oldGqlContentHashes.size, 0);
    },
    1000 * 1000,
  );
});
