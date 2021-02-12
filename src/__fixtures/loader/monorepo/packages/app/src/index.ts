import { useGetFruitsQuery } from './fruits.graphql';

export function App() {
  const { data, loading } = useGetFruitsQuery();

  if (loading) {
    return 'Loading...';
  }

  return JSON.stringify(data, null, 2);
}
