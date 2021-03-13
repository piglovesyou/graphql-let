import { promises as fsPromises } from 'fs';

export const { readFile, writeFile, unlink } = fsPromises;
export { exists, readFileSync, statSync } from 'fs';
