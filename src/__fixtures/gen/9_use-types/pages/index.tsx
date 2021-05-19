import { QueryResolvers, User } from 'graphql-let/__generated__/__types__';

// @ts-expect-error
var status1: User['status'] = new Date(); //TS2322: Type 'Date' is not assignable to type 'string'.

var status2: User['status'] = 'blaa';

export const resolvers1: Required<QueryResolvers> = {
  // @ts-expect-error
  viewer(...args) {
    return { id: 'a', name: 'a' }; // Property 'status' is missing in type '{ id: string; name: string; }' but required in type 'User'.
  },
};

export const resolvers2: Required<QueryResolvers> = {
  viewer(...args) {
    return { id: 'a', name: 'a', status: 'a' };
  },
};
