import gen from '../src/gen';
import { AbsFn, prepareFixtures } from './__tools/file';

let cwd: string, abs: AbsFn;

describe('"baseUrl" and "mappers" combo', () => {
  beforeAll(async () => {
    [cwd, abs] = await prepareFixtures(__dirname, '__fixtures/issue-118');
  });

  it('should run graphql-let command properly', async () => {
    await gen({ cwd });
  });
});
