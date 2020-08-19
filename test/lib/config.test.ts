import { join as pathJoin } from 'path';
import loadConfig, { loadConfigSync } from '../../src/lib/config';

const cwd = pathJoin(__dirname, '../__fixtures/config');

describe('config.ts', () => {
  beforeAll(() => {
    process.env.GRAPHQL_SERVER_ENDPOINT = 'https://yeah/graphql';
    process.env.GRAPHQL_SERVER_TOKEN = 'blaa';
  });

  afterAll(() => {
    delete process.env.GRAPHQL_SERVER_ENDPOINT;
    delete process.env.GRAPHQL_SERVER_TOKEN;
  });

  test('loads config with default values', async () => {
    const actual = await loadConfig(cwd, '.graphql-let-simple.yml');
    expect(actual).toMatchSnapshot();
  });

  test('interpolates environment variables', () => {
    const [{ schema }] = loadConfigSync(cwd, '.graphql-let-envvar.yml');
    expect(schema).toMatchSnapshot();
  });

  test('interpolates environment variables asynchronously', async () => {
    const [{ schema }] = await loadConfig(cwd, '.graphql-let-envvar.yml');
    expect(schema).toMatchSnapshot();
  });

  test('overwrite default values', async () => {
    const [actual] = await loadConfig(cwd, '.graphql-let-overwrite.yml');
    expect(actual).toMatchSnapshot();
  });
});
