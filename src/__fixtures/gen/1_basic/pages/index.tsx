import { useViewerQuery } from './viewer.graphql';

// @ts-expect-error
useViewerQuery();

// @ts-expect-error
useViewerQuery({ variables: {} });

const result = useViewerQuery({
  variables: { id: 'baa' },
});
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;
