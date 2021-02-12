import { join } from 'path';
import { cleanup } from './file';

const projRoot = join(__dirname, '../..');

export default function setup() {
  return cleanup(projRoot, ['**/.__fixtures']);
}
