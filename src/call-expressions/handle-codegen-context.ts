import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { writeFileSync } from 'fs';
import makeDir from 'make-dir';
import { basename, dirname, join } from 'path';
import slash from 'slash';
import { ExecContext } from '../lib/exec-context';
import { readFileSync } from '../lib/file';
import { CodegenContext } from '../lib/types';
import {
  CallExpressionPathPairs,
  parserOption,
  visitFromProgramPath,
} from './ast';
import { prepareAppendTiContext, typesRootRelDir } from './type-inject';

export function appendLiteralAndLoadCodegenContext(
  callExpressionPathPairs: CallExpressionPathPairs,
  execContext: ExecContext,
  schemaHash: string,
  sourceRelPath: string,
  sourceFullPath: string,
  codegenContext: CodegenContext[],
  cwd: string,
): void {
  if (!callExpressionPathPairs.length) return;

  for (const [, value, importName] of callExpressionPathPairs) {
    switch (importName) {
      case 'gql':
        {
          const gqlContent = value;
          const {
            gqlHash,
            createdPaths,
            shouldUpdate,
            resolvedGqlContent,
            dependantFullPaths,
          } = prepareAppendTiContext(
            execContext,
            schemaHash,
            sourceRelPath,
            sourceFullPath,
            gqlContent,
            sourceFullPath,
          );
          codegenContext.push({
            ...createdPaths,
            type: 'gql-call',
            gqlHash,
            gqlContent,
            resolvedGqlContent,
            skip: !shouldUpdate,
            dependantFullPaths,
          });
        }
        break;

      case 'load': {
        const gqlPathFragment = value;
        const gqlRelPath = join(dirname(sourceRelPath), gqlPathFragment);
        const gqlFullPath = join(cwd, gqlRelPath);
        const gqlContent = readFileSync(gqlFullPath, 'utf-8');
        const {
          gqlHash,
          createdPaths,
          shouldUpdate,
          dependantFullPaths,
        } = prepareAppendTiContext(
          execContext,
          schemaHash,
          sourceRelPath,
          sourceFullPath,
          gqlContent,
          gqlFullPath,
        );
        codegenContext.push({
          ...createdPaths,
          type: 'load-call',
          gqlHash,
          gqlPathFragment,
          gqlRelPath,
          gqlFullPath,
          skip: !shouldUpdate,
          dependantFullPaths,
        });
        break;
      }
    }
  }
}

export function appendLiteralAndLoadContextForTsSources(
  execContext: ExecContext,
  schemaHash: string,
  codegenContext: CodegenContext[],
  tsSourceRelPaths: string[],
) {
  const paths: [
    fileNode: t.File,
    programPath: NodePath<t.Program>,
    callExpressionPathPairs: CallExpressionPathPairs,
  ][] = [];

  if (!tsSourceRelPaths.length) return paths;

  const { cwd } = execContext;

  for (const sourceRelPath of tsSourceRelPaths) {
    const sourceFullPath = join(cwd, sourceRelPath);
    const sourceContent = readFileSync(sourceFullPath, 'utf-8');
    const fileNode = parse(sourceContent, parserOption);
    traverse(fileNode, {
      Program(programPath: NodePath<t.Program>) {
        const { callExpressionPathPairs } = visitFromProgramPath(programPath);

        appendLiteralAndLoadCodegenContext(
          callExpressionPathPairs,
          execContext,
          schemaHash,
          sourceRelPath,
          sourceFullPath,
          codegenContext,
          cwd,
        );

        paths.push([fileNode, programPath, callExpressionPathPairs]);
      },
    });
  }

  return paths;
}

export function writeTiIndexForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cwd, config } = execContext;
  const typeInjectEntrypointFullPath = join(cwd, config.typeInjectEntrypoint);
  const typeInjectEntrypointFullDir = join(
    cwd,
    dirname(config.typeInjectEntrypoint),
  );
  const gqlDtsMacroFullPath = join(typeInjectEntrypointFullDir, 'macro.d.ts');
  makeDir.sync(typeInjectEntrypointFullDir);

  let hasLiteral = false;
  let hasLoad = false;
  let dtsEntrypointContent = '';
  for (const c of codegenContext) {
    switch (c.type) {
      case 'document-import':
      case 'schema-import':
        continue;
      case 'gql-call': {
        // For TS2691
        const dtsRelPathWithoutExtension = slash(
          join(
            typesRootRelDir,
            dirname(c.dtsRelPath),
            basename(c.dtsRelPath, '.d.ts'),
          ),
        );
        dtsEntrypointContent += `import T${c.gqlHash} from './${dtsRelPathWithoutExtension}';
export function gql(gql: \`${c.gqlContent}\`): T${c.gqlHash}.__GraphQLLetTypeInjection;
`;
        hasLiteral = true;
        break;
      }

      case 'load-call': {
        // For TS2691
        const dtsRelPathWithoutExtension = slash(
          join(
            typesRootRelDir,
            dirname(c.dtsRelPath),
            basename(c.dtsRelPath, '.d.ts'),
          ),
        );
        dtsEntrypointContent += `import T${c.gqlHash} from './${dtsRelPathWithoutExtension}';
export function load(load: \`${c.gqlPathFragment}\`): T${c.gqlHash}.__GraphQLLetTypeInjection;
`;
        hasLoad = true;
        break;
      }
    }
  }
  writeFileSync(typeInjectEntrypointFullPath, dtsEntrypointContent);
  if (hasLiteral || hasLoad) {
    writeFileSync(
      gqlDtsMacroFullPath,
      (hasLiteral ? `export { gql } from ".";\n` : '') +
        (hasLoad ? `export { load } from ".";\n` : ''),
    );
  }
}
