import { generate } from '@graphql-codegen/cli';
import { CodegenContext as CodegenConfig } from '@graphql-codegen/cli/config';
import { Types } from '@graphql-codegen/plugin-helpers';
import makeDir from 'make-dir';
import path, { dirname } from 'path';
import slash from 'slash';
import { ConfigTypes } from './config';
import { ExecContext } from './exec-context';
import { writeFile } from './file';
import { withHash } from './hash';
import { toDotRelPath } from './paths';
import { printError } from './print';
import { CodegenContext, getSchemaImportContext, isAllSkip } from './types';
import ConfiguredOutput = Types.ConfiguredOutput;

function createFixedDocumentPresetConfig(
  context: CodegenContext,
  execContext: ExecContext,
  schemaTsxFullPath: string,
) {
  const { tsxFullPath } = context;
  const {
    config: { config: userConfig },
  } = execContext;
  const relPathToSchema = slash(
    toDotRelPath(
      path.relative(
        dirname(tsxFullPath),
        schemaTsxFullPath.slice(0, schemaTsxFullPath.length - '.tsx'.length),
      ),
    ),
  );
  return {
    preset: 'import-types',
    presetConfig: {
      typesPath: relPathToSchema,
      // Pass user config to presetConfig too to let them decide importTypesNamespace
      ...userConfig,
    },
  };
}

const FIXED_DOCUMENT_PLUGIN_CONFIG = { importOperationTypesFrom: '' };
function appendFixedDocumentPluginConfig(
  plugins: ConfigTypes['plugins'],
): ConfigTypes['plugins'] {
  return plugins.map((p) => {
    if (typeof p === 'string') {
      // Ugly patch: I think "Root Level" and "Output Level" config
      // are not passed to plugins. Only "Plugin Level" works.
      return {
        [p]: FIXED_DOCUMENT_PLUGIN_CONFIG,
      };
    } else {
      return { ...p, ...FIXED_DOCUMENT_PLUGIN_CONFIG };
    }
  });
}

export function buildCodegenConfig(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cwd, config } = execContext;
  const generates: {
    [outputPath: string]: ConfiguredOutput;
  } = Object.create(null);
  const {
    // dtsFullPath: schemaDtsFullPath,
    tsxFullPath: schemaTsxFullPath,
  } = getSchemaImportContext(codegenContext);

  for (const context of codegenContext) {
    if (context.skip) continue;
    const { tsxFullPath } = context;
    let opts: ConfiguredOutput;
    switch (context.type) {
      case 'schema-import':
        opts = {
          plugins: ['typescript', ...config.schemaPlugins],
        };
        break;

      case 'document-import':
      case 'load-call':
        opts = {
          plugins: appendFixedDocumentPluginConfig(config.plugins),
          documents: context.gqlRelPath,
          ...createFixedDocumentPresetConfig(
            context,
            execContext,
            schemaTsxFullPath,
          ),
        };
        break;

      case 'gql-call':
        opts = {
          plugins: appendFixedDocumentPluginConfig(config.plugins),
          documents: context.resolvedGqlContent,
          ...createFixedDocumentPresetConfig(
            context,
            execContext,
            schemaTsxFullPath,
          ),
        };
        break;
    }
    generates[tsxFullPath] = {
      ...config.generateOptions,
      ...opts,
    };
  }

  return {
    ...config,
    // Regardless of `silent` value in config,
    // we always suppress GraphQL code generator logs
    silent: true,

    // @ts-ignore
    cwd,

    // @ts-ignore This allows recognizing "#import" in GraphQL documents
    skipGraphQLImport: false,

    // In our config, "documents" should always be empty
    // since "generates" should take care of them.
    documents: undefined,
    generates,
  };
}

async function processGraphQLCodegen(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
  generateArg: CodegenConfig | (Types.Config & { cwd?: string }),
): Promise<Types.FileOutput[]> {
  let results: Types.FileOutput[];
  try {
    results = await generate(generateArg, false);
  } catch (error) {
    if (error.name === 'ListrError' && error.errors != null) {
      for (const err of error.errors) {
        if (err.details) err.message = `${err.message}${err.details}`;
        printError(err);
      }
    }
    throw error;
  }
  // Object option "generates" in codegen obviously doesn't guarantee result's order.
  const tsxPathTable = new Map<string, CodegenContext>(
    codegenContext.map((c) => [c.tsxFullPath, c]),
  );
  for (const result of results) {
    const { filename, content } = result;
    const context = tsxPathTable.get(filename);
    if (!context) throw new Error('never');
    await makeDir(path.dirname(filename));
    await writeFile(filename, withHash(context.gqlHash, content));
  }
  return results;
}

export async function processCodegenForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
): Promise<Types.FileOutput[]> {
  if (isAllSkip(codegenContext)) return [];
  const codegenConfig = buildCodegenConfig(execContext, codegenContext);
  return await processGraphQLCodegen(
    execContext,
    codegenContext,
    codegenConfig,
  );
}
