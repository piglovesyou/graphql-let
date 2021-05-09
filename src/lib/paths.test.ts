import { removeExtname } from './paths';

describe('paths.test.ts', () => {
  test('removeExtname', async () => {
    expect(removeExtname('/a/b/c/d.tsx')).toEqual('/a/b/c/d');
    expect(removeExtname('../../c/d.tsx')).toEqual('../../c/d');
    expect(removeExtname('./c/d.graphql.tsx')).toEqual('c/d.graphql');
  });
});
