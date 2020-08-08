import * as V1ffee34aad94b8da4e33faf385ded9238d7affef from "./node_modules/graphql-let/__generated__/input-1ffee34aad94b8da4e33faf385ded9238d7affef.tsx";
const {
  useViewerQuery
} = V1ffee34aad94b8da4e33faf385ded9238d7affef;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
