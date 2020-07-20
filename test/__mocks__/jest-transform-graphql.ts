import type { Transformer } from '@jest/transform';

const transformer: Transformer = {
  process(input) {
    return '""" jest-transform-graphql mock """\n' + input;
  },
};

export default transformer;
