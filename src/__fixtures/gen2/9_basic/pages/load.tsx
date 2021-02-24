import { load } from 'graphql-let';

const { useViewerQuery } = load('./viewer.graphql');

const result = useViewerQuery();
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;
