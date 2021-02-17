import { load } from 'graphql-let/macro';

const { useViewerQuery } = load(`./viewer.grpahql`);

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
