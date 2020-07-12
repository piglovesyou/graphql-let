import makeDir from 'make-dir';
import path from 'path';
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
import { withHash, writeFile } from './file';
import { ConfigTypes } from './types';

const essentialCompilerOptions: CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: true,
  noEmit: false,
};

function resolveCompilerOptions(configObj: ConfigTypes) {
  const fileName = configObj.TSConfigFile || 'tsconfig.json';
  const configPath = findConfigFile(process.cwd(), sys.fileExists, fileName);
  let compilerOptions = essentialCompilerOptions;

  if (configPath != null) {
    const { config, error } = readConfigFile(configPath, (name) =>
      sys.readFile(name),
    );
    if (config != null) {
      const settings = convertCompilerOptionsFromJson(
        { ...config['compilerOptions'], ...essentialCompilerOptions },
        process.cwd(),
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
  tsxFullPaths: string[],
  configObj: ConfigTypes,
): string[] {
  const compilerOptions = resolveCompilerOptions(configObj);

  const compilerHost = createCompilerHost(compilerOptions);

  const dtsContents: string[] = [];
  compilerHost.writeFile = (name, dtsContent) => {
    // XXX: How to improve memory usage?
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

  return dtsContents;
}

export async function processGenDts(
  dtsFullPath: string,
  tsxFullPath: string,
  gqlRelPath: string,
  sourceHash: string,
  config: ConfigTypes,
) {
  await makeDir(path.dirname(dtsFullPath));
  const [dtsContent] = await genDts([tsxFullPath], config);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(dtsFullPath, withHash(sourceHash, dtsContent));
  return dtsContent;
}
