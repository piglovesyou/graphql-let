import { gql } from 'graphql-let/macro';

const { useViewerQuery } = gql(`
  # import Partial from './documents/partial.graphql'
  query Viewer {
    viewer {
      ...Partial
    }
  }
`);

function nest1() {
  function nest2() {
    function nest3() {
      function nest4() {
        function MyComponent() {
          useViewerQuery().data.viewer.name as string;
          // @ts-expect-error
          useViewerQuery() as number;
        }
      }
    }
  }
}
