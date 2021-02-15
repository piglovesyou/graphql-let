import { gql } from 'graphql-let/macro';

const { useViewerQuery } = gql(`query Viewer { viewer { name } }`);

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
