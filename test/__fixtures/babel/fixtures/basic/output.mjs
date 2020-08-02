import * as V3daf5b4311465bd8566d77d548e135871cc11646 from "./node_modules/graphql-let/__generated__/input-3daf5b4311465bd8566d77d548e135871cc11646.tsx";
const {
  useViewerQuery
} = V3daf5b4311465bd8566d77d548e135871cc11646;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
