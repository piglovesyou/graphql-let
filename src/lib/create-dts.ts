import path from 'path';
import { createCompilerHost, createProgram, CompilerOptions } from 'typescript';
import memoize from './memoize';

const options: CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: false,
};

export function createDts(tsxFullPaths: string[]): string[] {
  const compilerHost = createCompilerHost({});

  const dtsContents: string[] = [];
  compilerHost.writeFile = (name, dtsContent) => {
    // To make sure the order of input files and call of "writeFile" consistent
    const pathFragment = path.join(
      path.dirname(name),
      path.basename(name, '.d.ts'),
    );
    const tsxFullPath = tsxFullPaths[dtsContents.length];
    if (!tsxFullPath.startsWith(pathFragment)) {
      throw new Error(
        'TypeScript API was not expected as graphql-let developer, it needs to be fixed',
      );
    }
    dtsContents.push(dtsContent);
  };

  const program = createProgram(tsxFullPaths, options, compilerHost);
  program.emit();

  if (dtsContents.length !== tsxFullPaths.length) {
    throw new Error('Fails to generate .d.ts.');
  }

  return dtsContents;
}
