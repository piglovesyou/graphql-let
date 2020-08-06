import { join as pathJoin } from 'path';
import loadConfig from '../../src/lib/config';
import { processGraphQLCodegenForDocuments } from '../../src/lib/documents';
import createExecContext from '../../src/lib/exec-context';
import { createPaths } from '../../src/lib/paths';
import { FileCodegenContext } from '../../src/lib/types';

const cwd = pathJoin(__dirname, '../__fixtures/graphql-codegen');

describe('graphql-codegen.ts', () => {
  test(
    'xx',
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
      const result = await processGraphQLCodegenForDocuments(
        execContext,
        codegenContext,
      );
      console.log(result);
    },
    1000 * 1000,
  );
});
