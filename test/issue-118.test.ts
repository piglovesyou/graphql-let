import { join as pathJoin } from 'path';
import { rimraf } from './__tools/file';

const cwd = pathJoin(__dirname, '__fixtures/issue-118');
const rel = (relPath: string) => pathJoin(cwd, relPath);
import gen from '../src/gen';

describe('"baseUrl" and "mappers" combo', () => {
  beforeAll(async () => {
    await rimraf(rel('__generated__'));
    await rimraf(rel('**/*.graphql.d.ts'));
    await rimraf(rel('**/*.graphqls.d.ts'));
  });

  it('should run graphql-let command properly', async () => {
    await gen({ cwd });
  });
});
