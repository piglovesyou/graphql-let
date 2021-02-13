/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ok } from 'assert';
import pick from 'lodash.pick';
import gen from './gen';
import * as prints from './lib/print';
import { CodegenContext } from './lib/types';
import { spawn } from './lib/__tools/child-process';
import { AbsFn, cleanup, prepareFixtures, rename } from './lib/__tools/file';
import { matchPathsAndContents } from './lib/__tools/match-paths-and-contents';

let cwd: string;
let abs: AbsFn;

describe('"graphql-let" command', () => {
  beforeAll(async () => {
    [cwd, abs] = await prepareFixtures(__dirname, '__fixtures/gen/99_mixed');
    await rename(abs('_gitignore'), abs('.gitignore'));
  });

  beforeEach(() =>
    cleanup(cwd, [
      '**/__generated__',
      '**/*.graphql.d.ts',
      '**/*.graphqls.d.ts',
    ]),
  );

  test('basic', async () => {
    const [cwd] = await prepareFixtures(__dirname, '__fixtures/gen/1_basic');
    await gen({ cwd });
    await matchPathsAndContents(
      ['**/*.graphql.d.ts', '**/*.graphqls.d.ts'],
      cwd,
    );
    await spawn('yarn', ['tsc'], { cwd });
  });

  test(`generates number of .d.ts ignoring specified files as expected
* ignoring "!" paths in "schema" and "documents" of graphql-let.yml
* ignoring files specified in .gitignore
`, async () => {
    await gen({ cwd });
    await matchPathsAndContents(
      ['**/*.graphql.d.ts', '**/*.graphqls.d.ts', '__generated__/**/*.tsx'],
      cwd,
    );
  });

  test(`runs twice and keeps valid caches`, async () => {
    const pickProperties = (context: CodegenContext) =>
      pick(context, ['gqlRelPath', 'tsxRelPath', 'dtsRelPath', 'gqlHash']);
    const result1 = await gen({ cwd });
    for (const { skip, dtsRelPath } of result1)
      ok(!skip, `${dtsRelPath} should be newly created!`);
    expect(result1.map(pickProperties)).toMatchSnapshot();
    await matchPathsAndContents(['__generated__/**/*.tsx'], cwd);

    const result2 = await gen({ cwd });
    for (const { skip, dtsRelPath } of result2)
      ok(skip, `${dtsRelPath} should be cached!`);

    expect(result2.map(pickProperties)).toMatchSnapshot();
    await matchPathsAndContents(['__generated__/**/*.tsx'], cwd);
  });

  test(`passes config to graphql-codegen as expected
* "useIndexSignature: true" in config effect to result having "WithIndex<TObject>" type
`, async () => {
    await gen({ cwd });
    await matchPathsAndContents(['schema/type-defs.graphqls.d.ts'], cwd);
  });

  test(`documents: **/*.tsx generates .d.ts for babel`, async () => {
    await gen({ cwd, configFilePath: '.graphql-let-babel.yml' });
    await matchPathsAndContents(['__generated__', 'node_modules'], cwd);
  });

  test(`fails with detailed message on codegen error`, async () => {
    const printedMessages: string[] = [];
    const printError = jest.spyOn(prints, 'printError');
    printError.mockImplementation((err: Error) => {
      printedMessages.push(err.message);
    });
    try {
      await gen({ cwd, configFilePath: '.graphql-let-broken.yml' });
    } catch (e) {
      expect(printedMessages.length).toBe(1);
      expect(printedMessages[0]).toContain(`Failed to load schema
        Failed to load schema from broken/**/*.graphqls:

        Type "Broke" not found in document.
        Error: Type "Broke" not found in document.`);
    }
  });
});
