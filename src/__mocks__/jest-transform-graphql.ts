import { Transformer } from '@jest/transform';

const transformer: Transformer = {
  process(input) {
    return '""" jest-transform-graphql mock """\n' + input;
  },
  getCacheKey(fileData) {
    return fileData;
  },
};

export default transformer;
