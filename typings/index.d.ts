declare module 'terminate';
declare module '@babel/helper-transform-fixture-test-runner';
declare module '@babel/helper-plugin-utils';
declare module '@graphql-codegen/plugin-helpers' {
  import { Types } from '@graphql-codegen/plugin-helpers';
  import { JSONObject } from 'do-sync';
  Types.UrlSchemaWithOptions = JSONObject; // Make it serializable
  export { Types };
}
