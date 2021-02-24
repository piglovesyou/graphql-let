import genDeprecated from '../src/genDeprecated';
import { prepareFixtures } from '../src/lib/__tools/file';

let cwd: string;

describe('"baseUrl" and "mappers" combo', () => {
  beforeAll(async () => {
    [cwd] = await prepareFixtures(__dirname, '__fixtures/issue-118');
  });

  it('should run graphql-let command properly', async () => {
    await genDeprecated({ cwd });
  });
});
