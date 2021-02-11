import { join } from 'path';
import { cleanup } from './file';

const testDir = join(__dirname, '../');

export default function setup() {
  return cleanup(testDir);
}
