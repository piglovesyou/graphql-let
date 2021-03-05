import { promises as fsPromises } from 'fs';
import _rimraf from 'rimraf';
import { promisify } from 'util';

export const rimraf = promisify(_rimraf);

export const { readFile, writeFile, unlink } = fsPromises;
export { exists, readFileSync, statSync } from 'fs';
