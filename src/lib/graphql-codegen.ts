import {
  CodegenContext as CodegenConfig,
  generate,
} from '@graphql-codegen/cli';
import { Types } from '@graphql-codegen/plugin-helpers';
import makeDir from 'make-dir';
import path from 'path';
import { ExecContext } from './exec-context';
import { withHash, writeFile } from './file';
import { printError } from './print';
import { CodegenContext } from './types';
import ConfiguredOutput = Types.ConfiguredOutput;

export function buildCodegenConfig(
  { cwd, config }: ExecContext,
  codegenContext: CodegenContext[],
) {
  const generates: {
    [outputPath: string]: ConfiguredOutput;
  } = Object.create(null);

  for (const context of codegenContext) {
    const { tsxFullPath } = context;

    let documents: string;
    switch (context.type) {
      case 'literal':
        // XXX: We want to pass shorter `strippedGqlContent`,
        // but `# import` also disappears!
        documents = context.gqlContent;
        break;
      default:
        documents = context.gqlRelPath;
    }
    generates[tsxFullPath] = {
      ...config.generateOptions,
      // graphql-let -controlled fields:
      documents,
      plugins: config.plugins,
    };
  }

  return {
    silent: true,
    ...config,
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

export async function processGraphQLCodegen(
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
        err.message = `${err.message}${err.details}`;
        printError(err);
      }
    } else {
      printError(error);
    }
    throw error;
  }
  if (codegenContext.length !== results.length) throw new Error('never');
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
