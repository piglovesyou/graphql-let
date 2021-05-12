import { generate } from '@graphql-codegen/cli';
import { CodegenContext as CodegenConfig } from '@graphql-codegen/cli/config';
import { Types } from '@graphql-codegen/plugin-helpers';
import makeDir from 'make-dir';
import path, { dirname } from 'path';
import { ConfigTypes } from './config';
import { ExecContext } from './exec-context';
import { writeFile } from './file';
import { withHash } from './hash';
import { printError } from './print';
import { CodegenContext, isAllSkip } from './types';
import ConfiguredOutput = Types.ConfiguredOutput;

const OPTIONAL_SCHEMA_PLUGINS = ['typescript-resolvers'];
function findOptionalSchemaPlugins() {
  const plugins: string[] = [];
  for (const c of OPTIONAL_SCHEMA_PLUGINS) {
    try {
      plugins.push(c);
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }
  return plugins;
}

// To avoid unnecessary complexity, graphql-let controls
// all the presets including plugin options related to it as its spec.
// I think it works for many of users, but there could be
// cases where you need to configure this more. Issue it then.
function getFixedSchemaConfig() {
  return {
    plugins: ['typescript', ...findOptionalSchemaPlugins()],
  };
}

function createFixedDocumentPresetConfig(
  context: CodegenContext,
  schemaDtsFullPath: string,
) {
  const { dtsFullPath } = context;
  const relPathToSchema = path.relative(
    dirname(dtsFullPath),
    schemaDtsFullPath.slice(0, schemaDtsFullPath.length - '.d.ts'.length),
  );
  return {
    preset: 'import-types',
    presetConfig: {
      typesPath: relPathToSchema.startsWith('.')
        ? relPathToSchema
        : './' + relPathToSchema,
      importTypesNamespace: '__SchemaTypes__', // I guess this is enough to avoid name duplication
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
  { cwd, config }: ExecContext,
  codegenContext: CodegenContext[],
) {
  const generates: {
    [outputPath: string]: ConfiguredOutput;
  } = Object.create(null);

  const context = codegenContext.find(({ type }) => type === 'schema-import');
  if (!context) throw new Error('"schema-import" context must appear');
  const { dtsFullPath: schemaDtsFullPath } = context;

  for (const context of codegenContext) {
    if (context.skip) continue;
    const { tsxFullPath } = context;
    let opts: ConfiguredOutput;
    switch (context.type) {
      case 'schema-import':
        opts = getFixedSchemaConfig();
        break;

      case 'document-import':
      case 'load-call':
        opts = {
          plugins: appendFixedDocumentPluginConfig(config.plugins),
          documents: context.gqlRelPath,
          ...createFixedDocumentPresetConfig(context, schemaDtsFullPath),
        };
        break;

      case 'gql-call':
        opts = {
          plugins: appendFixedDocumentPluginConfig(config.plugins),
          documents: context.resolvedGqlContent,
          ...createFixedDocumentPresetConfig(context, schemaDtsFullPath),
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
        err.message = `${err.message}${err.details || ''}`;
        printError(err);
      }
    } else {
      printError(error);
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
