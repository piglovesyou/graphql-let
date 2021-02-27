import logUpdate from 'log-update';
import { loader } from 'webpack';
import { appendFileSchemaContext } from './file-schema/resolver-types';
import { processCodegenForContext } from './gen';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import { readFile } from './lib/file';
import memoize from './lib/memoize';
import { PRINT_PREFIX } from './lib/print';
import { CodegenContext } from './lib/types';

const processGraphQLCodegenSchemaLoader = memoize(
  async (cwd: string) => {
    const [config, configHash] = await loadConfig(cwd);
    const execContext = createExecContext(cwd, config, configHash);
    const codegenContext: CodegenContext[] = [];

    await appendFileSchemaContext(execContext, codegenContext);
    if (!codegenContext.length) throw new Error('Never');

    const [{ skip, tsxFullPath }] = codegenContext;
    if (skip) return await readFile(tsxFullPath, 'utf-8');

    const [{ content }] = await processCodegenForContext(
      execContext,
      codegenContext,
    );

    await processDtsForContext(execContext, codegenContext);

    return content;
  },
  () => 'schemaLoader',
);

const graphlqCodegenSchemaLoader: loader.Loader = function (gqlContent) {
  const callback = this.async()!;
  const { rootContext: cwd } = this;

  processGraphQLCodegenSchemaLoader(cwd)
    .then(() => {
      callback(undefined, gqlContent);
    })
    .catch((e) => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphlqCodegenSchemaLoader;
