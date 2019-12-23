import path from 'path';

export function getTsxBaseDir(cwd: string, generateDir: string): string {
  return path.join(cwd, generateDir);
}
