// import { generate } from "@graphql-codegen/cli";
import generator from '@babel/generator';
import logUpdate from 'log-update';
import { loader } from 'webpack';
import { relative as pathRelative, join, extname } from 'path';
import { modifyLiteralCalls, visitLiteralCalls } from './babel';
import { DEFAULT_CONFIG_FILENAME } from './lib/consts';
import { processDocumentsForContext } from './lib/documents';
import { processDtsForContext } from './lib/dts';
import createExecContext from './lib/exec-context';
import loadConfig from './lib/config';
import { parserOption } from './lib/literals/fns';
import { processLiteralsWithDtsGenerate } from './lib/literals/literals';
import memoize from './lib/memoize';
import { isTypeScriptPath } from './lib/paths';
import { createSchemaHash, shouldGenResolverTypes } from './lib/resolver-types';
import { PRINT_PREFIX, updateLog } from './lib/print';
import { readFile } from './lib/file';
import { CodegenContext, LiteralCodegenContext } from './lib/types';
import * as t from '@babel/types';
import { parse, ParserOptions } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';

const processGraphQLLetLoader = memoize(
  async (
    resourceFullPath: string,
    resourceContent: string | Buffer,
    addDependency: (path: string) => void,
    cwd: string,
  ): Promise<{ resourceFullPath: string; content: string }> => {
    const [config, configHash] = await loadConfig(cwd);
    const execContext = createExecContext(cwd, config, configHash);
    const resourceRelPath = pathRelative(cwd, resourceFullPath);

    // To pass config change on subsequent generation,
    // configHash should be primary hash seed.
    let schemaHash = configHash;

    if (shouldGenResolverTypes(config)) {
      schemaHash = await createSchemaHash(execContext);
      const schemaFullPath = join(cwd, config.schemaEntrypoint);

      // If using resolver types, all documents should depend on all schema files.
      addDependency(schemaFullPath);
    }

    const codegenContext: CodegenContext[] = [];
    const ext = extname(resourceFullPath);

    if (isTypeScriptPath(resourceFullPath, ext)) {
      const ast = parse(String(resourceContent), parserOption);
      const content: string = await new Promise((resolve) => {
        traverse(ast, {
          Program(programPath: NodePath<t.Program>) {
            // TODO: refactor
            const importName = 'graphql-let';
            const onlyMatchImportSuffix = false;

            const visitLiteralCallResults = visitLiteralCalls(
              programPath,
              importName,
              onlyMatchImportSuffix,
            );
            const { literalCallExpressionPaths } = visitLiteralCallResults;

            // TODO: Handle error

            if (!literalCallExpressionPaths.length) return;

            const gqlContents = literalCallExpressionPaths.map(
              ([, value]) => value,
            );
            processLiteralsWithDtsGenerate(
              execContext,
              resourceRelPath,
              gqlContents,
            ).then((literalCodegenContext: LiteralCodegenContext[]) => {
              modifyLiteralCalls(
                programPath,
                resourceFullPath,
                visitLiteralCallResults,
                literalCodegenContext,
              );
              const { code } = generator(ast);
              resolve(code);
            });
          },
        });
      });
      if (!content) throw Error('never');
      return { resourceFullPath, content };
    }
    // is GraphQL document
    const tsxFullPath = `${resourceFullPath}.tsx`;

    const [result] = await processDocumentsForContext(
      execContext,
      schemaHash,
      codegenContext,
      [resourceRelPath],
      [String(resourceContent)],
    );

    let content: string;
    // Cache was obsolete
    if (result) {
      const { content: _content } = result;
      content = _content;
      updateLog('Generating .d.ts...');
      await processDtsForContext(execContext, codegenContext);
      updateLog(`${resourceRelPath} was generated.`);

      // Hack to prevent duplicated logs for simultaneous build, in SSR app for an example.
      await new Promise((resolve) => setTimeout(resolve, 0));
      logUpdate.done();
    } else {
      // When cache is fresh, just load it
      if (codegenContext.length !== 1) throw new Error('never');
      const [{ tsxFullPath }] = codegenContext;
      content = await readFile(tsxFullPath, 'utf-8');
    }
    return { resourceFullPath: tsxFullPath, content };
    // }
  },
  (gqlFullPath: string) => gqlFullPath,
);

const graphQLLetLoader: loader.Loader = function (gqlContent) {
  const callback = this.async()!;
  const { resourcePath, rootContext: cwd } = this;

  processGraphQLLetLoader(
    resourcePath,
    gqlContent,
    this.addDependency.bind(this),
    cwd,
  )
    .then(({ resourceFullPath, content }) => {
      // Pretend .tsx for later loaders.
      // babel-loader at least doesn't respond the .graphql extension.
      this.resourcePath = resourceFullPath;

      callback(undefined, content);
    })
    .catch((e) => {
      logUpdate.stderr(PRINT_PREFIX + e.message);
      logUpdate.stderr.done();
      callback(e);
    });
};

export default graphQLLetLoader;
