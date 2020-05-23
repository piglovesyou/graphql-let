import makeDir from 'make-dir';
import path from 'path';
import { createCompilerHost, createProgram, CompilerOptions } from 'typescript';
import { withHash, writeFile } from './file';

const options: CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: true,
};

function getModuleNameForPath(p: string): string {
  const baseName = path.basename(p);
  return baseName.startsWith('*') ? baseName : '*/' + baseName;
}

export function wrapAsModule(filePath: string, content: string) {
  const moduleName = getModuleNameForPath(filePath);
  return `declare module '${moduleName}' {
  ${content
    .trim()
    .replace(/\nexport declare /g, '\nexport ')
    .replace(/\n/g, '\n  ')}
}`;
}

export function genDts(tsxFullPaths: string[]): string[] {
  const compilerHost = createCompilerHost({});

  const dtsContents: string[] = [];
  compilerHost.writeFile = (name, dtsContent) => {
    const pathFragment = path.join(
      path.dirname(name),
      path.basename(name, '.d.ts'),
    );
    const tsxFullPath = tsxFullPaths[dtsContents.length];
    // If the compiler generates all .d.ts files successfully,
    // the order of .tsx array and corresponding .d.ts array is identical.
    // If it's out of order, it means the compilation failed.
    const isCorrectOrder = tsxFullPath.startsWith(pathFragment);
    if (!isCorrectOrder) {
      throw new Error(
        `Failed to generate .d.ts from .tsx:
\t${tsxFullPath}
Take a look at the .tsx file and check what went wrong.`,
      );
    }
    // XXX: How to improve memory usage?
    dtsContents.push(dtsContent);
  };

  const program = createProgram(tsxFullPaths, options, compilerHost);
  program.emit();

  // Make sure the lengths are same, just in case
  if (dtsContents.length !== tsxFullPaths.length) {
    throw new Error('Fails to generate .d.ts.');
  }

  return dtsContents;
}

export async function processGenDts(
  dtsFullPath: string,
  tsxFullPath: string,
  gqlRelPath: string,
  sourceHash: string,
) {
  await makeDir(path.dirname(dtsFullPath));
  const [dtsContent] = await genDts([tsxFullPath]);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(dtsFullPath, withHash(sourceHash, dtsContent));
  return dtsContent;
}
