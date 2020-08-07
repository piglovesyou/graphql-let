import { join as pathJoin } from 'path';
import loadConfig from '../../src/lib/config';
import { processGraphQLCodegenForFiles } from '../../src/lib/documents';
import createExecContext from '../../src/lib/exec-context';
import { createPaths } from '../../src/lib/paths';
import { FileCodegenContext } from '../../src/lib/types';
import { matchPathsAndContents } from '../__tools/match-paths-and-contents';

const cwd = pathJoin(__dirname, '../__fixtures/graphql-codegen');

describe('graphql-codegen.ts', () => {
  test(
    'works',
    async () => {
      const [config, configHash] = await loadConfig(cwd);

      const execContext = createExecContext(cwd, config, configHash);
      const paths = createPaths(execContext, 'pages/viewer.graphql');
      const codegenContext: FileCodegenContext[] = [
        {
          ...paths,
          gqlHash: 'xx',
          skip: false,
          dtsContentDecorator: (_) => _,
        },
      ];
      await processGraphQLCodegenForFiles(execContext, codegenContext);
      await matchPathsAndContents(['__generated__'], cwd);
    },
    1000 * 1000,
  );
});
