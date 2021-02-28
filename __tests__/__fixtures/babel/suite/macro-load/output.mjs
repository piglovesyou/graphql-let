import * as Va8ca7f2176b9dce4e4ba81526fcae512e2279848 from "./node_modules/graphql-let/__generated__/input-Viewer-Partial.ts";
const {
  useViewerQuery
} = Va8ca7f2176b9dce4e4ba81526fcae512e2279848;

function nest1() {
  function nest2() {
    function nest3() {
      function nest4() {
        function MyComponent() {
          useViewerQuery().data.viewer.name; // @ts-expect-error

          useViewerQuery();
        }
      }
    }
  }
}
