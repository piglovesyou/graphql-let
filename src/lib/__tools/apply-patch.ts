import { applyPatch as diffApplyPatch } from 'diff';
import { join } from 'path';
import { readFile, writeFile } from './file';

export async function applyPatch(cwd: string, targetRelPath: string) {
  await writeFile(
    join(cwd, targetRelPath),
    diffApplyPatch(
      await readFile(join(cwd, targetRelPath)),
      await readFile(join(cwd, '__patches', targetRelPath)),
    ),
  );
}
