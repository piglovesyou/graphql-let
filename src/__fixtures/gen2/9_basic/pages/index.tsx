import { useViewer2Query } from './viewer.graphql';

const result = useViewer2Query();
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;
