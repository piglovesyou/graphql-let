import makeDir from 'make-dir';
import path from 'path';
import { createCompilerHost, createProgram, CompilerOptions } from 'typescript';
import { writeFile } from './file';

const options: CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: false,
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
    // XXX: How to improve memory usage?
    dtsContents.push(dtsContent);
  };

  const program = createProgram(tsxFullPaths, options, compilerHost);
  program.emit();

  if (dtsContents.length !== tsxFullPaths.length) {
    throw new Error('Fails to generate .d.ts.');
  }

  return dtsContents;
}

export async function processGenDts(
  dtsFullPath: string,
  tsxFullPath: string,
  gqlRelPath: string,
) {
  await makeDir(path.dirname(dtsFullPath));
  const [dtsContent] = await genDts([tsxFullPath]);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(dtsFullPath, wrapAsModule(gqlRelPath, dtsContent));
  return dtsContent;
}
