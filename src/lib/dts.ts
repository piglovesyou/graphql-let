import { promises as fsPromises } from 'fs';
import _mkdirp from 'mkdirp';
import path from 'path';
import { createCompilerHost, createProgram, CompilerOptions } from 'typescript';
import { promisify } from 'util';
import memoize from './memoize';

const { writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);

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

export function wrapAsModule(fileName: string, content: string) {
  return `declare module '*/${fileName}' {
  ${content.replace(/\n/g, '\n  ')}}`;
}

export const writeDts = memoize(
  async function(dtsFullPath: string, tsxFullPath: string, gqlRelPath: string) {
    await mkdirp(path.dirname(dtsFullPath));
    const [dtsContent] = await createDts([tsxFullPath]);
    if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
    await writeFile(
      dtsFullPath,
      wrapAsModule(path.basename(gqlRelPath), dtsContent),
    );
    return dtsContent;
  },
  dtsFullPath => dtsFullPath,
);
