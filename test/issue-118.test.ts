import { join as pathJoin } from 'path';
import gen from '../src/gen';
import { cleanup } from './__tools/file';

const cwd = pathJoin(__dirname, '__fixtures/issue-118');
const abs = (relPath: string) => pathJoin(cwd, relPath);

describe('"baseUrl" and "mappers" combo', () => {
  beforeAll(() => cleanup(cwd));

  it('should run graphql-let command properly', async () => {
    await gen({ cwd });
  });
});
