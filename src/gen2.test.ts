import gen from './gen2';
import { spawn } from './lib/__tools/child-process';
import { prepareFixtures } from './lib/__tools/file';

describe('gen2.ts', () => {
  test('gen', async () => {
    const [cwd] = await prepareFixtures(__dirname, '__fixtures/gen2/9_basic');
    await gen({ cwd });
    await spawn('yarn', ['tsc'], { cwd });
  });
});
