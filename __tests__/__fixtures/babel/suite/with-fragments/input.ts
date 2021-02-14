import gql from 'graphql-let';
const { useViewerQuery } = gql(`
  # import Partial from './partial.graphql'
  query Viewer {
    viewer {
      ...Partial
    }
  }
`);

useViewerQuery().data.viewer.id as string;
useViewerQuery().data.viewer.name as string;
// @ts-expect-error
useViewerQuery().data.viewer.status as string;
// @ts-expect-error
useViewerQuery() as number;
