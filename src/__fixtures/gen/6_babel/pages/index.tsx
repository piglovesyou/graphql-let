import { gql } from 'graphql-let';

const { useViewerXQuery } = gql(`
  query ViewerX {
    viewer {
      name
    }
  }
`);
useViewerXQuery().data.viewer.name as string;
// @ts-expect-error
useViewerXQuery() as number;

const { useViewerYQuery } = gql(`
  # import Partial from './partial.graphql'
  query ViewerY {
    viewer {
      ...Partial
    }
  }
`);
useViewerYQuery().data.viewer.name as string;
// @ts-expect-error
useViewerYQuery() as number;
