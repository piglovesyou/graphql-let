import * as Vad9b45029d41eaef1a445c10ab1d564a0b518e42 from "./node_modules/graphql-let/__generated__/input-ad9b45029d41eaef1a445c10ab1d564a0b518e42.tsx";
const {
  useViewerQuery
} = Vad9b45029d41eaef1a445c10ab1d564a0b518e42;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
