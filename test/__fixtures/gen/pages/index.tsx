import gql from 'graphql-let';

gql(`
  query ViewerX {
    viewer {
      name
    }
  }
`);

gql(`
  # import Partial from './partial.graphql'
  query ViewerY {
    viewer {
      ...Partial
    }
  }
`);
