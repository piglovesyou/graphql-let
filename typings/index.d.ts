declare module 'terminate';

declare module 'jest-transform-graphql' {
  import { Transformer } from '@jest/transform';
  const transformer: Transformer;
  export default transformer;
}
