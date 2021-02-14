import { join } from 'path';
import { cleanup, prepareFixtures } from './file';

const projRoot = join(__dirname, '../..');

export default async function setup() {
  await cleanup(projRoot, ['**/.__fixtures']);

  // XXX: Hacky. @babel/helper-transform-fixture-test-runner wants this.
  await prepareFixtures(join(__dirname, '../../'), '__fixtures/babel-plugin');
}
