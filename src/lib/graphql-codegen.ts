import { Types } from '@graphql-codegen/plugin-helpers';
import { generate } from '@graphql-codegen/cli';
import makeDir from 'make-dir';
import path from 'path';
import { ExecContext } from './exec-context';
import { withHash, writeFile } from './file';
import { printError } from './print';
import { CodegenContext } from './types';
import { CodegenContext as CodegenConfig } from '@graphql-codegen/cli';

export async function processGraphQLCodegen(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
  generateArg: CodegenConfig | (Types.Config & { cwd?: string }),
): Promise<Types.FileOutput[]> {
  try {
    const results: Types.FileOutput[] = await generate(generateArg, false);
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
