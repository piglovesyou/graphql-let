import * as Ve6b32f237e3cad27e834458ef50fb3f3d9d7294c from "./node_modules/graphql-let/__generated__/input-e6b32f237e3cad27e834458ef50fb3f3d9d7294c.tsx";
const {
  useViewerQuery
} = Ve6b32f237e3cad27e834458ef50fb3f3d9d7294c;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
