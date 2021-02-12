import gql from 'graphql-let';
const { useViewerQuery } = gql(`
  # import Partial from './partial.graphql'
  query Viewer {
    viewer {
      ...Partial
    }
  }
`);

export default function Viewer() {
  const { data } = useViewerQuery();
  if (data) return <div>{data.viewer.name}</div>;
}
