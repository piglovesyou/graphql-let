import { join as pathJoin } from 'path';
import { processCodegenForContext } from './codegen';
import loadConfig from './config';
import createExecContext from './exec-context';
import { createPaths, createSchemaPaths } from './paths';
import { CodegenContext } from './types';
import { matchPathsAndContents } from './__tools/match-paths-and-contents';

const cwd = pathJoin(__dirname, '__fixtures/graphql-codegen');

describe('graphql-codegen.ts', () => {
  test('works', async () => {
    const [config, configHash] = await loadConfig(cwd);

    const execContext = createExecContext(cwd, config, configHash);
    const codegenContext: CodegenContext[] = [
      {
        ...createSchemaPaths(execContext),
        type: 'schema-import',
        gqlHash: 'xx',
        skip: false,
      },
      {
        ...createPaths(execContext, 'pages/viewer.graphql'),
        type: 'document-import',
        gqlHash: 'xx',
        skip: false,
      },
    ];
    await processCodegenForContext(execContext, codegenContext);
    await matchPathsAndContents(['__generated__'], cwd);
  });
});
