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
    // XXX: How to improve memory usage?
    dtsContents.push(dtsContent);
  };

  const program = createProgram(tsxFullPaths, options, compilerHost);
  const result = program.emit();

  // Make sure that the compilation is successful
  if (result.emitSkipped) {
    result.diagnostics.forEach(diagnostic => {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
      // log diagnostic message
      console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    });
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
