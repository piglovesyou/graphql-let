import * as V4de3a990eddfa70dba05f32dbaca0afc6aca7bda from "./node_modules/graphql-let/__generated__/input-Viewer.ts";
const {
  useViewerQuery
} = V4de3a990eddfa70dba05f32dbaca0afc6aca7bda;

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
