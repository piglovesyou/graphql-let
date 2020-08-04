import gql from 'graphql-let';
const { useViewerQuery } = gql(`
  query ViewerX {
    viewer {
      name
    }
  }
`);
