import { useViewerQuery } from './viewer.graphql';

const result = useViewerQuery();
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;
