import path from 'path';

export function getTsxBaseDir(): string {
  const libDir = path.resolve(__dirname, '..');
  return path.join(libDir, '__generated__');
}
