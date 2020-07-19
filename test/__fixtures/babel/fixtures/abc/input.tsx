// @ts-ignore
import gql from 'graphql-let';
// @ts-ignore
const { useViewerQuery } = gql('query Viewer { viewer { name } }');

export default function Viewer() {
  const { data } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
