import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { writeFileSync } from 'fs';
import { stripIgnoredCharacters } from 'graphql';
import makeDir from 'make-dir';
import { basename, dirname, join as pathJoin } from 'path';
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
          const strippedGqlContent = stripIgnoredCharacters(gqlContent);
          const {
            gqlHash,
            createdPaths,
            shouldUpdate,
            resolvedGqlContent,
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
            strippedGqlContent,
            skip: !shouldUpdate,
          });
        }
        break;

      case 'load': {
        const gqlPathFragment = value;
        const gqlRelPath = pathJoin(dirname(sourceRelPath), gqlPathFragment);
        const gqlFullPath = pathJoin(cwd, gqlRelPath);
        const gqlContent = readFileSync(gqlFullPath, 'utf-8');
        const { gqlHash, createdPaths, shouldUpdate } = prepareAppendTiContext(
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
  if (!tsSourceRelPaths.length) return;

  const { cwd } = execContext;

  for (const sourceRelPath of tsSourceRelPaths) {
    const sourceFullPath = pathJoin(cwd, sourceRelPath);
    const sourceContent = readFileSync(sourceFullPath, 'utf-8');
    const sourceAST = parse(sourceContent, parserOption);
    traverse(sourceAST, {
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
      },
    });
  }
}

export function writeTiIndexForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cwd, config } = execContext;
  const gqlDtsEntrypointFullPath = pathJoin(cwd, config.gqlDtsEntrypoint);
  const gqlDtsEntrypointFullDir = pathJoin(
    cwd,
    dirname(config.gqlDtsEntrypoint),
  );
  const gqlDtsMacroFullPath = pathJoin(gqlDtsEntrypointFullDir, 'macro.d.ts');
  makeDir.sync(gqlDtsEntrypointFullDir);

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
          pathJoin(
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
          pathJoin(
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
  writeFileSync(gqlDtsEntrypointFullPath, dtsEntrypointContent);
  if (hasLiteral || hasLoad) {
    writeFileSync(
      gqlDtsMacroFullPath,
      (hasLiteral ? `export { gql } from ".";\n` : '') +
        (hasLoad ? `export { load } from ".";\n` : ''),
    );
  }
}
