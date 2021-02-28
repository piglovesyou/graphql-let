import { gql, load } from 'graphql-let';

const { useViewerQuery } = load('./viewer.graphql');
useViewerQuery().data.viewer.name as string;
// @ts-expect-error
useViewerQuery() as number;

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
