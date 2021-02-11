import { join as pathJoin } from 'path';
import gen from '../src/gen';

const cwd = pathJoin(__dirname, '__fixtures/issue-118');

describe('"baseUrl" and "mappers" combo', () => {
  it('should run graphql-let command properly', async () => {
    await gen({ cwd });
  });
});
