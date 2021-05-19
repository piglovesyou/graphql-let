/* 9a3469f23fffcea0e7fcaa8c00a0d83ac12a80e4
 * This file is automatically generated by graphql-let. */

import * as Types from '../node_modules/@types/graphql-let/__generated__/__types__';
import * as Apollo from '@apollo/client';
export declare type ViewerQueryVariables = Types.Exact<{
    [key: string]: never;
}>;
export declare type ViewerQuery = ({
    __typename?: 'Query';
} & {
    viewer?: Types.Maybe<({
        __typename?: 'User';
    } & PartialFragment)>;
});
export declare type PartialFragment = ({
    __typename?: 'User';
} & Pick<Types.User, 'id' | 'name' | 'status'>);
export declare const PartialFragmentDoc: Apollo.DocumentNode;
export declare const ViewerDocument: Apollo.DocumentNode;
/**
 * __useViewerQuery__
 *
 * To run a query within a React component, call `useViewerQuery` and pass it any options that fit your needs.
 * When your component renders, `useViewerQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useViewerQuery({
 *   variables: {
 *   },
 * });
 */
export declare function useViewerQuery(baseOptions?: Apollo.QueryHookOptions<ViewerQuery, ViewerQueryVariables>): Apollo.QueryResult<ViewerQuery, any>;
export declare function useViewerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ViewerQuery, ViewerQueryVariables>): Apollo.QueryTuple<ViewerQuery, any>;
export declare type ViewerQueryHookResult = ReturnType<typeof useViewerQuery>;
export declare type ViewerLazyQueryHookResult = ReturnType<typeof useViewerLazyQuery>;
export declare type ViewerQueryResult = Apollo.QueryResult<ViewerQuery, ViewerQueryVariables>;
