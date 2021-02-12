import { join as pathJoin } from 'path';
import loadConfig from './config';
import { processGraphQLCodegenForFiles } from './documents';
import createExecContext from './exec-context';
import { createPaths } from './paths';
import { FileCodegenContext } from './types';
import { matchPathsAndContents } from './__tools/match-paths-and-contents';

const cwd = pathJoin(__dirname, '__fixtures/graphql-codegen');

describe('graphql-codegen.ts', () => {
  test('works', async () => {
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
  });
});
