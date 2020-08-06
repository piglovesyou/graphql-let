import generator from '@babel/generator';
import { parse, ParserOptions } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { basename, dirname, extname, join as pathJoin } from 'path';
import { LiteralCreatedPaths } from '../types';

export function createPaths(
  srcRelPath: string,
  hash: string,
  dtsRelDir: string,
  cacheFullDir: string,
  cwd: string,
): LiteralCreatedPaths {
  const abs = (relPath: string) => pathJoin(cwd, relPath);

  const dtsGenFullDir = abs(dtsRelDir);
  // srcRelPath: "pages/index.tsx"
  // "pages"
  const relDir = dirname(srcRelPath);
  // ".tsx"
  const ext = extname(srcRelPath);
  // "${cwd}/pages/index.tsx"
  const srcFullPath = abs(srcRelPath);
  // "index"
  const base = basename(srcRelPath, ext);

  // "index-2345.tsx"
  const tsxBasename = `${base}-${hash}${ext}`;
  // "pages/index-2345.tsx"
  const tsxRelPath = pathJoin(relDir, tsxBasename);
  // "/Users/.../node_modules/graphql-let/__generated__/pages/index-2345.d.ts"
  const tsxFullPath = pathJoin(cacheFullDir, tsxRelPath);

  // "index-2345.d.ts"
  const dtsBasename = `${base}-${hash}.d.ts`;
  // "pages/index-2345.d.ts"
  const dtsRelPath = pathJoin(relDir, dtsBasename);
  // "/Users/.../node_modules/@types/graphql-let/pages/index-2345.d.ts"
  const dtsFullPath = pathJoin(dtsGenFullDir, dtsRelPath);
  return {
    srcRelPath,
    srcFullPath,
    tsxRelPath,
    tsxFullPath,
    dtsRelPath,
    dtsFullPath,
  };
}

export const parserOption: ParserOptions = {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
};

export function appendExportAsObject(dtsContent: string) {
  // TODO: Build ast?
  let allExportsCode = `export declare type __AllExports = { `;
  const visitors: any = {
    TSDeclareFunction({
      node: {
        id: { name },
      },
    }: any) {
      allExportsCode += `${name}: typeof ${name},`;
    },
  };
  visitors.VariableDeclarator = visitors.TSTypeAliasDeclaration = function pushProps({
    node: {
      id: { name },
    },
  }: any) {
    allExportsCode += `${name}: ${name},`;
  };

  const dtsAST = parse(dtsContent, parserOption);
  traverse(dtsAST, {
    ExportNamedDeclaration(path: any) {
      path.traverse(visitors);
    },
    Program: {
      exit(path: NodePath<t.Program>) {
        allExportsCode += '};';
        // TODO: refactor
        traverse(parse(allExportsCode, parserOption), {
          ExportNamedDeclaration({ node }) {
            const body = path.get('body');
            body[body.length - 1].insertAfter(node);
          },
        });
      },
    },
  });

  const { code } = generator(dtsAST);
  return code;
}
