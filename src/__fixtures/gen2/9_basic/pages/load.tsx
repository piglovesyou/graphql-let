import { load } from 'graphql-let';

const { useViewer2Query } = load('./viewer.graphql');

const result = useViewer2Query();
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;
