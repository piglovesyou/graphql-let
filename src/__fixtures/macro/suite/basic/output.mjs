import * as V1ffee34aad94b8da4e33faf385ded9238d7affef from "./node_modules/graphql-let/__generated__/input-1ffee34aad94b8da4e33faf385ded9238d7affef.ts";
const {
  useViewerQuery
} = V1ffee34aad94b8da4e33faf385ded9238d7affef;

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
