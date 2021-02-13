import gql from 'graphql-let';
const { useViewerQuery } = gql('query Viewer { viewer { name } }');

useViewerQuery().data.viewer.name as string;
// @ts-expect-error
useViewerQuery() as number;
