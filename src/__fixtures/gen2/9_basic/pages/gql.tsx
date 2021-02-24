import { gql } from 'graphql-let';

const { useViewer1Query } = gql(`
  query Viewer1 {
      viewer {
          id
          name
          status
      }
  }
`);

const result = useViewer1Query();
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;
