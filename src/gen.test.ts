/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { statSync } from 'fs';
import glob from 'globby';
import pick from 'lodash.pick';
import gen from './gen';
import * as prints from './lib/print';
import { CodegenContext, DocumentImportCodegenContext } from './lib/types';
import { applyPatch } from './lib/__tools/apply-patch';
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

    const result1 = await gen({ cwd });
    for (const r of result1) expect(r).toMatchObject({ skip: false });
    expect(result1.map(pickProperties)).toMatchSnapshot();

    const result2 = await gen({ cwd });
    for (const r of result2) expect(r).toMatchObject({ skip: true });
    expect(result2.map(pickProperties)).toMatchSnapshot();

    for (const [i, r2] of result2.entries()) {
      const r1 = result1[i];
      switch (r2.type) {
        case 'document-import':
          expect(statSync(r2.gqlFullPath).mtime).toStrictEqual(
            statSync((r1 as DocumentImportCodegenContext).gqlFullPath).mtime,
          );
        case 'schema-import':
          expect(statSync(r2.tsxFullPath).mtime).toStrictEqual(
            statSync(r1.tsxFullPath).mtime,
          );
          expect(statSync(r2.dtsFullPath).mtime).toStrictEqual(
            statSync(r1.dtsFullPath).mtime,
          );
          break;
        default:
          throw new Error(`"${r2.type}" should not appear this time`);
      }
    }
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

  test(`fails with detailed message on codegen schema load error`, async () => {
    const [cwd] = await prepareFixtures(__dirname, '__fixtures/gen/7_broken');
    try {
      await gen({ cwd });
    } catch (e) {
      expect(e.message).toContain(`Unknown type "Broke". Did you mean "Broken"`);
    }
  });

  test(`remove obsolete files`, async () => {
    const [cwd] = await prepareFixtures(
      __dirname,
      '__fixtures/gen/8_remove-obsolete',
    );
    await gen({ cwd });
    await spawn('yarn', ['tsc'], { cwd });

    const firstFiles = (await glob(['**/*.d.ts', '**/*.tsx'], { cwd })).sort();
    await applyPatch(cwd, 'pages/index.tsx', '__patches/pages/index.tsx.patch');
    await applyPatch(
      cwd,
      'pages/viewer.graphql',
      '__patches/pages/viewer.graphql.patch',
    );

    await gen({ cwd });
    await spawn('yarn', ['tsc'], { cwd });

    const secondFiles = (await glob(['**/*.d.ts', '**/*.tsx'], { cwd })).sort();

    const removed = firstFiles.filter((e) => !secondFiles.includes(e));
    expect(removed).toMatchSnapshot('Removed files');
    const added = secondFiles.filter((e) => !firstFiles.includes(e));
    expect(added).toMatchSnapshot('Added files');
  });

  test(`Use types and Resolver Types`, async () => {
    const [cwd] = await prepareFixtures(
      __dirname,
      '__fixtures/gen/9_use-types',
    );
    await gen({ cwd });
    await matchPathsAndContents(
      ['**/*.graphql.d.ts', '**/*.graphqls.d.ts'],
      cwd,
    );
    await spawn('yarn', ['tsc'], { cwd });
  });
});
