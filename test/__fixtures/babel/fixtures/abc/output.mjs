import * as V07138c from "./node_modules/graphql-let/__generated__/input-07138c.tsx";
// @ts-ignore
const {
  useViewerQuery
} = V07138c;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
