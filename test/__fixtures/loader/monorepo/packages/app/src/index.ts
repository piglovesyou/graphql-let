import { useViewerQuery } from './viewer.graphql';

export function App() {
  const { data, loading } = useViewerQuery();

  if (loading) {
    return 'Loading...';
  }

  return JSON.stringify(data, null, 2);
}
