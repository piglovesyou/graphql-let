import * as V6500e855ce0d4683a1e6e953a93084b382d7a765 from "./node_modules/graphql-let/__generated__/input-6500e855ce0d4683a1e6e953a93084b382d7a765.tsx";
const {
  useViewerQuery
} = V6500e855ce0d4683a1e6e953a93084b382d7a765;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
