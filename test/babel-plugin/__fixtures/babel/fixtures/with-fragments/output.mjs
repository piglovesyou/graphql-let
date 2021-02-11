import * as V3e81ed6254d58faa4d4bb8a12568fa59509c0acb from "./node_modules/graphql-let/__generated__/input-3e81ed6254d58faa4d4bb8a12568fa59509c0acb.tsx";
const {
  useViewerQuery
} = V3e81ed6254d58faa4d4bb8a12568fa59509c0acb;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
