/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  createSystem,
  createDefaultMapFromNodeModules,
  createVirtualCompilerHost,
} from '@typescript/vfs';
import fs from 'fs';
import ts from 'typescript';
import { ok } from 'assert';
import { join as pathJoin, dirname } from 'path';
import gen from '../src/gen';

jest.mock('cross-fetch');

import { fetch } from 'cross-fetch';

import { rimraf } from './__tools/file';
const cwd = pathJoin(__dirname, '__fixtures/tsconfig');
const rel = (relPath: string) => pathJoin(cwd, relPath);
const getLib = (name: string) => {
  const lib = dirname(require.resolve('typescript'));
  return fs.readFileSync(pathJoin(lib, name), 'utf8');
};

const filenames = fs.readdirSync(cwd, { withFileTypes: true });

describe('"graphql-let" command', () => {
  beforeAll(async () => {
    await rimraf(pathJoin(__dirname, '../__generated__'));
    await rimraf(rel('**/*.graphql.d.ts'));
    await rimraf(rel('**/*.graphqls.d.ts'));
  }, 60 * 1000);

  beforeEach(() => {
    const fsMap = createDefaultMapFromNodeModules({});
    filenames.forEach((file) => {
      if (file.isFile()) {
        fsMap.set(rel(file.name), fs.readFileSync(rel(file.name)).toString());
      } else if (file.isDirectory()) {
        const subFiles = fs.readdirSync(rel(file.name), {
          withFileTypes: true,
        });
        subFiles.forEach((subfile) => {
          if (subfile.isFile()) {
            const fullPath = rel(pathJoin(file.name, subfile.name));
            fsMap.set(fullPath, fs.readFileSync(fullPath).toString());
          }
        });
      }
    });
    const system = createSystem(fsMap);
    const mock = jest.fn().mockImplementation((compileOptions) => {
      const host = createVirtualCompilerHost(system, compileOptions, ts);
      const { getSourceFile } = host.compilerHost;
      host.compilerHost.getSourceFile = (filenames, lv, onError, should) => {
        if (
          typeof filenames === 'string' &&
          !fsMap.has(filenames) &&
          filenames.endsWith('tsx')
        ) {
          fsMap.set(filenames, fs.readFileSync(filenames).toString());
        } else {
          fsMap.set(filenames, getLib(filenames));
        }
        return getSourceFile(filenames, lv, onError, should);
      };
      return host.compilerHost;
    });
    ts.createCompilerHost = mock;
  });
  test(
    'fails when ts is not configured correctly',
    async () => {
      let error;
      try {
        await gen({
          cwd,
          configFilePath: 'graphql-let.yml',
        });
      } catch (e) {
        error = e;
      }
      ok(error.message.indexOf('Failed to generate .d.ts.') >= 0);
    },
    60 * 1000,
  );
  test(
    'passes with the correct tsconfig',
    async () => {
      let error = null;
      try {
        await gen({
          cwd,
          configFilePath: 'graphql-let2.yml',
        });
      } catch (e) {
        error = e;
      }
      ok(error === null);
    },
    60 * 1000,
  );
  test(
    'reads default tsconfig',
    async () => {
      const findConfigFileMock = jest.spyOn(ts, 'findConfigFile');
      let error = null;
      try {
        await gen({
          cwd,
          configFilePath: 'graphql-let3.yml',
        });
      } catch (e) {
        error = e;
      }
      ok(error === null);
      expect(findConfigFileMock).toBeCalledWith(
        expect.any(String),
        expect.any(Function),
        'tsconfig.json',
      );
    },
    60 * 1000,
  );
  test(
    'handles schema objects',
    async () => {
      // eslint-disable-next-line
      const schemaJson = require('./__fixtures/tsconfig/schema.json');
      (fetch as any).mockReturnValue({
        json() {
          return { data: schemaJson };
        },
      });
      let error = null;
      try {
        await gen({
          cwd,
          configFilePath: 'graphql-let4.yml',
        });
      } catch (e) {
        console.log(e);
        error = e;
      }
      ok(error === null, error);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/graphql',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'GRAPHQL-LET',
          }),
        }),
      );
    },
    60 * 1000,
  );
});
