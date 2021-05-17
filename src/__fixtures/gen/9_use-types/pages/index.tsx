import { QueryResolvers } from 'graphql-let/__generated__/__types__';

export const resolvers1: Required<QueryResolvers> = {
  // @ts-expect-error
  viewer(...args) {
    return { id: 'a', name: 'a' }; // A prop lacks!
  },
};

export const resolvers2: Required<QueryResolvers> = {
  viewer(...args) {
    return { id: 'a', name: 'a', status: 'a' };
  },
};
