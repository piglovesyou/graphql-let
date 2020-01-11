/* eslint-disable @typescript-eslint/no-non-null-assertion */

import assert from 'assert';
import compiler from './compiler';
import { promisify } from 'util';
import { join as pathJoin } from 'path';
import _rimraf from 'rimraf';

const rimraf = promisify(_rimraf);

const expect = `function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

import gql from 'graphql-tag';
import * as React from 'react';
import * as ApolloReactComponents from '@apollo/react-components';
import * as ApolloReactHooks from '@apollo/react-hooks';
export const ViewerDocument = gql\`
    query Viewer {
  viewer {
    id
    name
    status
  }
}
    \`;
export const ViewerComponent = props => React.createElement(ApolloReactComponents.Query, _extends({
  query: ViewerDocument
}, props));
/**
 * __useViewerQuery__
 *
 * To run a query within a React component, call \`useViewerQuery\` and pass it any options that fit your needs.
 * When your component renders, \`useViewerQuery\` returns an object from Apollo Client that contains loading, error, and data properties 
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

export function useViewerQuery(baseOptions) {
  return ApolloReactHooks.useQuery(ViewerDocument, baseOptions);
}
export function useViewerLazyQuery(baseOptions) {
  return ApolloReactHooks.useLazyQuery(ViewerDocument, baseOptions);
}`;

describe('graphql-let/loader', () => {
  beforeEach(async () => {
    await rimraf(pathJoin(__dirname, '__generated__'));
  });

  test(
    'generates .tsx and .d.ts',
    async () => {
      const fixture = 'pages/viewer.graphql';
      const stats = await compiler(fixture, 'node');
      const { 0: actual, length } = stats
        .toJson()
        .modules!.map(m => m.source)
        .filter(Boolean);

      assert.deepStrictEqual(length, 1);
      assert.deepStrictEqual(actual, expect);
    },
    60 * 1000,
  );

  test(
    'runs well for simultaneous execution assuming SSR',
    async () => {
      const fixture = 'pages/viewer.graphql';
      const results = await Promise.all([
        compiler(fixture, 'node'),
        compiler(fixture, 'web'),
      ]);
      for (const stats of results) {
        const { 0: actual, length } = stats
          .toJson()
          .modules!.map(m => m.source)
          .filter(Boolean);

        assert.deepStrictEqual(length, 1);
        assert.deepStrictEqual(actual, expect);
      }
    },
    60 * 1000,
  );
});
