import { Types } from '@graphql-codegen/plugin-helpers';
import { generate } from '@graphql-codegen/cli';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import makeDir from 'make-dir';
import path from 'path';
import { ConfigTypes } from './config';
import { ExecContext } from './exec-context';
import { withHash, writeFile } from './file';
import { printError } from './print';
import {
  CodegenContext,
  FileCodegenContext,
  isLiteralContext,
  LiteralCodegenContext,
} from './types';
import ConfiguredOutput = Types.ConfiguredOutput;
import { CodegenContext as CodegenConfig } from '@graphql-codegen/cli';

export async function processGraphQLCodegen(
  options: Pick<Types.Config, 'schema' | 'documents'> & {
    cwd?: string;
    plugins: ConfigTypes['plugins'];
    config: ConfigTypes['config'];
    filename: string | string[];
    gqlHash: string;
  },
): Promise<string> {
  try {
    const results: Types.FileOutput[] = await generate(
      {
        cwd: options.cwd,
        schema: options.schema,
        documents: options.documents,

        generates: (Array.isArray(options.filename)
          ? options.filename
          : [options.filename]
        ).reduce<{
          [outputPath: string]: Types.ConfiguredOutput;
        }>((acc, filename) => {
          acc[filename] = {
            plugins: options.plugins,
            config: options.config,
          };
          return acc;
        }, {}),
      },
      false,
    );
    const resultsWithHash = results.map(({ filename, content }) => {
      // Embed hash for caching
      return {
        filename,
        content: withHash(options.gqlHash, content),
      };
    });
    await Promise.all(
      resultsWithHash.map(async ({ filename, content }) => {
        await makeDir(path.dirname(filename));
        await writeFile(filename, content);
      }),
    );
    return (resultsWithHash[0] && resultsWithHash[0].content) as string;
  } catch (e) {
    if (e.name === 'ListrError' && e.errors != null) {
      throw e.errors[0];
    } else {
      console.log('Error:', e);
    }
    throw e;
  }
}

class GraphQLLetConfig extends CodegenConfig {
  constructor(execContext: ExecContext, codegenContext: CodegenContext[]) {
    const { cwd, config, codegenOpts } = execContext;

    // In our config, "documents" should always be empty
    // since "generates" should take care of them.
    const generates = GraphQLLetConfig.buildGenerates(
      execContext,
      codegenContext,
      config,
    );
    super({
      config: {
        ...config,
        cwd,
        config: {
          // TODO: Quit using codegenOpts
          ...codegenOpts.config,
          ...config.config,
        },
        // schema: path.join(cwd, config.schema as any),
        documents: undefined,
        generates,
      },
    });
    this.cwd = cwd;
  }

  static buildGenerates(
    execContext: ExecContext,
    codegenContext: CodegenContext[],
    config: Omit<Types.Config, 'generates'> & ConfigTypes,
  ) {
    const generates: {
      [outputPath: string]: ConfiguredOutput;
    } = Object.create(null);
    for (const context of codegenContext) {
      const { tsxFullPath } = context;
      const documents = isLiteralContext(context)
        ? (context as LiteralCodegenContext).strippedGqlContent
        : (context as FileCodegenContext).gqlRelPath;
      generates[tsxFullPath] = {
        ...config.generateOptions,
        // graphql-let -controlled fields:
        documents,
        plugins: config.plugins,
      };
    }
    return generates;
  }

  // from graphql-file-loader
  static isGraphQLImportFile(rawSDL: string) {
    const trimmedRawSDL = rawSDL.trim();
    return (
      trimmedRawSDL.startsWith('# import') ||
      trimmedRawSDL.startsWith('#import')
    );
  }

  async loadDocuments(pointers: any) {
    const [pointer] = pointers;
    if (GraphQLLetConfig.isGraphQLImportFile(pointer)) {
      // GraphQLFileLoader only allows "# import" when passing file paths.
      // But we want it even in gql(`query {}`), don't we?
      const resolved = GraphQLFileLoader.prototype.handleFileContent(
        pointer,
        './a.graphql',
        { cwd: this.cwd },
      );
      return [resolved];
    }
    return super.loadDocuments(pointers); // , this.getConfig());
  }
}

export async function processGraphQLCodegenNew(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
): Promise<Types.FileOutput[]> {
  try {
    const results: Types.FileOutput[] = await generate(
      new GraphQLLetConfig(execContext, codegenContext),
      false,
    );
    if (codegenContext.length !== results.length) throw new Error('never');
    for (const [index, result] of results.entries()) {
      const { filename, content } = result;
      const context = codegenContext[index];
      if (!context) throw new Error('never');
      await makeDir(path.dirname(filename));
      await writeFile(filename, withHash(context.gqlHash, content));
    }
    return results;
  } catch (error) {
    if (error.name === 'ListrError' && error.errors != null) {
      for (const e of error.errors) printError(e);
      throw error.errors[0];
    } else {
      console.log('Error:', error);
    }
    throw error;
  }
}
