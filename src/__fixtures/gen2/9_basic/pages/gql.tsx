import { gql } from 'graphql-let';

const { useViewerQuery } = gql(`
  query Viewer {
      viewer {
          id
          name
          status
      }
  }
`);

const result = useViewerQuery();
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;
