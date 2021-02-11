import gen from '../src/gen';
import { prepareFixtures } from './__tools/file';

let cwd: string;

describe('"baseUrl" and "mappers" combo', () => {
  beforeAll(async () => {
    [cwd] = await prepareFixtures(__dirname, '__fixtures/issue-118');
  });

  it('should run graphql-let command properly', async () => {
    await gen({ cwd });
  });
});
