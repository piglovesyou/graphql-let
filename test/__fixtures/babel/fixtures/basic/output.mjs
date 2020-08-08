import * as V1b047c726c8d0878f30e33cdadada1a79f3a6c62 from "./node_modules/graphql-let/__generated__/input-1b047c726c8d0878f30e33cdadada1a79f3a6c62.tsx";
const {
  useViewerQuery
} = V1b047c726c8d0878f30e33cdadada1a79f3a6c62;
export default function Viewer() {
  const {
    data
  } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
