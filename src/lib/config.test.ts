import loadConfig, { ConfigTypes, loadConfigSync } from './config';
import { prepareFixtures } from './__tools/file';

let cwd: string;

// Some returned config values are absolute file paths that can change
// depending on the environment. This function makes them consistent by removing them.
const cleanConfig = ({ cwd, ...other }: ConfigTypes) => other;

describe('config.ts', () => {
  beforeAll(async () => {
    [cwd] = await prepareFixtures(__dirname, '__fixtures/config');
    process.env.GRAPHQL_SERVER_ENDPOINT = 'https://yeah/graphql';
    process.env.GRAPHQL_SERVER_TOKEN = 'blaa';
  });

  afterAll(() => {
    delete process.env.GRAPHQL_SERVER_ENDPOINT;
    delete process.env.GRAPHQL_SERVER_TOKEN;
  });

  test('loads config with default values', async () => {
    const [actual, hash] = await loadConfig(cwd, '.graphql-let-simple.yml');
    expect([cleanConfig(actual), hash]).toMatchSnapshot();
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
    expect(cleanConfig(actual)).toMatchSnapshot();
  });
});
