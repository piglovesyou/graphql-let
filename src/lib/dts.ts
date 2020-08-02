import makeDir from 'make-dir';
import path from 'path';
import slash from 'slash';
import {
  createCompilerHost,
  createProgram,
  CompilerOptions,
  flattenDiagnosticMessageText,
  sys,
  convertCompilerOptionsFromJson,
  findConfigFile,
  readConfigFile,
} from 'typescript';
import { ExecContext } from './exec-context';
import { withHash, writeFile } from './file';
import { CodegenContext } from './full-generate';
import { ConfigTypes } from './config';

const essentialCompilerOptions: CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: true,
  noEmit: false,
};

function resolveCompilerOptions(cwd: string, { TSConfigFile }: ConfigTypes) {
  const fileName = TSConfigFile || 'tsconfig.json';
  const configPath = findConfigFile(cwd, sys.fileExists, fileName);
  let compilerOptions = essentialCompilerOptions;

  if (configPath != null) {
    const { config, error } = readConfigFile(configPath, (name) =>
      sys.readFile(name),
    );
    if (config != null) {
      const settings = convertCompilerOptionsFromJson(
        { ...config['compilerOptions'], ...essentialCompilerOptions },
        cwd,
      );
      if (settings.errors.length > 0) {
        console.log(settings.errors);
      }
      compilerOptions = settings.options;
    } else if (error) {
      console.error(
        `${error.file && error.file.fileName}: ${error.messageText}`,
      );
    }
  } else {
    console.error(`Could not find a valid tsconfig file ('${fileName}').`);
  }

  return compilerOptions;
}

export function genDts(
  { cwd, config }: ExecContext,
  tsxFullPaths: string[],
): string[] {
  const compilerOptions = resolveCompilerOptions(cwd, config);
  tsxFullPaths = tsxFullPaths.map((tsxFullPath) => slash(tsxFullPath));
  const tsxFullPathSet = new Set(tsxFullPaths);

  const compilerHost = createCompilerHost(compilerOptions);

  const dtsContents: string[] = [];
  compilerHost.writeFile = (
    name,
    dtsContent,
    writeByteOrderMark,
    onError,
    sourceFiles,
  ) => {
    // TypeScript can write `d.ts`s of submodules imported from `.tsx`s.
    // We only pick up `.d.ts`s for `.tsx` entry points.
    const [{ fileName }] = sourceFiles!;
    if (!tsxFullPathSet.has(fileName)) return;
    dtsContents.push(dtsContent);
  };

  const program = createProgram(tsxFullPaths, compilerOptions, compilerHost);
  const result = program.emit();

  // Make sure that the compilation is successful
  if (result.emitSkipped) {
    result.diagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        const {
          line,
          character,
        } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
        // log diagnostic message
        const message = flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n',
        );
        console.error(
          `${diagnostic.file.fileName} (${line + 1},${
            character + 1
          }): ${message}`,
        );
      } else {
        console.error(
          `${flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`,
        );
      }
    });
    throw new Error('Failed to generate .d.ts.');
  }

  if (tsxFullPaths.length !== dtsContents.length) {
    throw new Error(
      `Never supposed to be here. Please make an issue on GitHub.`,
    );
  }

  return dtsContents;
}

export async function processGenDts(
  execContext: ExecContext,
  codegenContext: CodegenContext,
) {
  const { dtsFullPath, gqlHash } = codegenContext;
  await makeDir(path.dirname(dtsFullPath));
  const [dtsContent] = await genDts(execContext, [codegenContext.tsxFullPath]);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(dtsFullPath, withHash(gqlHash, dtsContent));
  return dtsContent;
}
