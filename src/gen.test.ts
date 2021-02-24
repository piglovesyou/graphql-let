/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { statSync } from 'fs';
import glob from 'globby';
import pick from 'lodash.pick';
import gen from './gen';
import * as prints from './lib/print';
import { CodegenContext, FileCodegenContext } from './lib/types';
import { spawn } from './lib/__tools/child-process';
import { prepareFixtures, rename } from './lib/__tools/file';
import { matchPathsAndContents } from './lib/__tools/match-paths-and-contents';

describe('"graphql-let" command', () => {
  test(`Basic command usage results in generating d.ts and passing tsc type check`, async () => {
    const [cwd] = await prepareFixtures(__dirname, '__fixtures/gen/1_basic');
    await gen({ cwd });
    await matchPathsAndContents(
      ['**/*.graphql.d.ts', '**/*.graphqls.d.ts'],
      cwd,
    );
    await spawn('yarn', ['tsc'], { cwd });
  });

  test('Glob pattern "!" in config excludes files', async () => {
    const [cwd] = await prepareFixtures(
      __dirname,
      '__fixtures/gen/2_exclude-files',
    );
    await gen({ cwd });
    const files = (
      await glob(['**/*.graphql.d.ts', '**/*.graphqls.d.ts'], { cwd })
    ).sort();
    expect(files).toMatchSnapshot();
  });

  test('Respect .gitignore to ignore from including', async () => {
    const [cwd, abs] = await prepareFixtures(
      __dirname,
      '__fixtures/gen/3_gitignore',
    );
    await rename(abs('_gitignore'), abs('.gitignore'));
    await gen({ cwd });
    const files = (
      await glob(['**/*.graphql.d.ts', '**/*.graphqls.d.ts'], { cwd })
    ).sort();
    expect(files).toMatchSnapshot();
  });

  test(`Runs twice and keeps valid caches`, async () => {
    const [cwd] = await prepareFixtures(
      __dirname,
      '__fixtures/gen/4_keep-caches',
    );
    const pickProperties = (context: CodegenContext) =>
      pick(context, ['gqlRelPath', 'tsxRelPath', 'dtsRelPath', 'gqlHash']);

    const result1 = (await gen({ cwd })) as FileCodegenContext[];
    for (const r of result1) expect(r).toMatchObject({ skip: false });
    expect(result1.map(pickProperties)).toMatchSnapshot();

    const result2 = (await gen({ cwd })) as FileCodegenContext[];
    for (const r of result2) expect(r).toMatchObject({ skip: true });
    expect(result2.map(pickProperties)).toMatchSnapshot();

    const props = ['tsxFullPath', 'dtsFullPath', 'gqlFullPath'] as (
      | 'tsxFullPath'
      | 'dtsFullPath'
      | 'gqlFullPath'
    )[];
    for (const prop of props)
      for (const [i, r2] of result2.entries())
        expect(statSync(r2[prop]).mtime).toStrictEqual(
          statSync(result1[i][prop]).mtime,
        );
  });

  test(`passes config to graphql-codegen as expected
* "useIndexSignature: true" in config effect to result having "WithIndex<TObject>" type
`, async () => {
    const [cwd] = await prepareFixtures(
      __dirname,
      '__fixtures/gen/5_pass-config',
    );
    await gen({ cwd });
    await matchPathsAndContents(['schema/type-defs.graphqls.d.ts'], cwd);
  });

  test(`documents: **/*.tsx generates .d.ts for babel`, async () => {
    const [cwd] = await prepareFixtures(__dirname, '__fixtures/gen/6_babel');
    await gen({ cwd });
    await matchPathsAndContents(['node_modules'], cwd);
    await spawn('yarn', ['tsc'], { cwd });
  });

  test(`fails with detailed message on codegen error`, async () => {
    const [cwd] = await prepareFixtures(__dirname, '__fixtures/gen/7_broken');
    const printedMessages: string[] = [];
    const printError = jest.spyOn(prints, 'printError');
    printError.mockImplementation((err: Error) => {
      printedMessages.push(err.message);
    });
    try {
      await gen({ cwd });
    } catch (e) {
      expect(printedMessages.length).toBe(2); // TODO: Why 2?
      expect(printedMessages[0]).toContain(`Failed to load schema
        Failed to load schema from **/*.graphqls:

        Type "Broke" not found in document.
        Error: Type "Broke" not found in document.`);
    }
  });

  test('gen', async () => {
    const [cwd] = await prepareFixtures(__dirname, '__fixtures/gen2/9_basic');
    await gen({ cwd });
    await spawn('yarn', ['tsc'], { cwd });
  });
});
