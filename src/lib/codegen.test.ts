import { join } from 'path';
import { processCodegenForContext } from './codegen';
import loadConfig from './config';
import { createExecContext } from './exec-context';
import { createPaths } from './paths';
import { matchPathsAndContents } from './__tools/match-paths-and-contents';

const cwd = join(__dirname, '__fixtures/graphql-codegen');

describe('graphql-codegen.ts', () => {
  test('works', async () => {
    const [config, configHash] = await loadConfig(cwd);

    const { execContext, codegenContext } = await createExecContext(
      cwd,
      config,
      configHash,
    );
    codegenContext.push({
      ...createPaths(execContext, 'pages/viewer.graphql'),
      type: 'document-import',
      gqlHash: 'xx',
      skip: false,
    });
    await processCodegenForContext(execContext, codegenContext);
    await matchPathsAndContents(['.cache'], cwd);
  });
});
