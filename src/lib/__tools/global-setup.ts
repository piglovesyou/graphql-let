import { join } from 'path';
import { cleanup, prepareFixtures } from './file';

const projRoot = join(__dirname, '../../..');

export default async function setup() {
  await cleanup(projRoot, ['**/.__fixtures']);

  // XXX: babel-plugin-tester wants this.
  await prepareFixtures(
    join(__dirname, '../../../__tests__'),
    '__fixtures/babel',
  );
}
