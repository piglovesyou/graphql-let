import generator from '@babel/generator';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { File, stringLiteral } from '@babel/types';
import makeDir from 'make-dir';
import { dirname, relative } from 'path';
import slash from 'slash';
import {
  CompilerOptions,
  convertCompilerOptionsFromJson,
  createCompilerHost,
  createProgram,
  findConfigFile,
  flattenDiagnosticMessageText,
  JsxEmit,
  readConfigFile,
  sys,
} from 'typescript';
import { parserOption } from '../call-expressions/ast';
import { appendObjectExport } from '../call-expressions/decorate-dts';
import { ConfigTypes } from './config';
import { ExecContext } from './exec-context';
import { writeFile } from './file';
import { withHash } from './hash';
import { SCHEMA_TYPES_BASENAME, toDotRelPath } from './paths';
import { CodegenContext, getSchemaImportContext, isAllSkip } from './types';

const essentialCompilerOptions: CompilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: true,
  jsx: JsxEmit.Preserve,
  noEmit: false,
};

function fixDtsImportPaths(
  context: CodegenContext,
  dtsAST: File,
  schemaDtsFullPath: string,
) {
  const { dtsFullPath, type } = context;
  const relPathToSchema = slash(
    toDotRelPath(
      relative(
        dirname(dtsFullPath),
        schemaDtsFullPath.slice(0, schemaDtsFullPath.length - '.d.ts'.length),
      ),
    ),
  );

  traverse(dtsAST, {
    ImportDeclaration(path) {
      if (path.node.source.value.endsWith(SCHEMA_TYPES_BASENAME)) {
        switch (type) {
          case 'document-import':
            path.node.source = stringLiteral(
              'graphql-let/__generated__/__types__',
            );
            break;
          case 'gql-call':
          case 'load-call':
            path.node.source = stringLiteral(relPathToSchema);
            break;
        }
      }
    },
  });
  // It's okay if there's no import declaration

  return dtsAST;
}

function decorateDts(
  context: CodegenContext,
  dtsContent: string,
  schemaDtsFullPath: string,
) {
  const { type } = context;
  const dtsAST = parse(dtsContent, parserOption);

  switch (type) {
    case 'load-call':
    case 'gql-call':
      appendObjectExport(dtsAST);
    case 'document-import':
      // XXX: Ugly way to fix import paths
      fixDtsImportPaths(context, dtsAST, schemaDtsFullPath);
  }

  const { code } = generator(dtsAST);
  return code;
  // return dtsContent;
}

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
        config['compilerOptions'],
        cwd,
      );
      if (settings.errors.length > 0) {
        console.log(settings.errors);
      }
      compilerOptions = { ...settings.options, ...essentialCompilerOptions };
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

export async function processDtsForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  if (isAllSkip(codegenContext)) return;

  const dtsContents = genDts(
    execContext,
    codegenContext.map(({ tsxFullPath }) => tsxFullPath),
  );

  const {
    dtsFullPath: schemaDtsFullPath,
    // tsxFullPath: schemaTsxFullPath,
  } = getSchemaImportContext(codegenContext);

  await makeDir(dirname(codegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const ctx = codegenContext[i];
    const { dtsFullPath, gqlHash } = ctx!;
    let content = decorateDts(ctx!, dtsContent, schemaDtsFullPath);
    content = withHash(gqlHash, content);
    await makeDir(dirname(dtsFullPath));
    await writeFile(dtsFullPath, content);
  }
}
