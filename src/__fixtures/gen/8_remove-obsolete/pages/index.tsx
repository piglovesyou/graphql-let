import { gql, load } from 'graphql-let';
import { useViewerQuery } from './viewer.graphql';

const result = useViewerQuery();
result.data.viewer.status as string;
// @ts-expect-error
result.data.viewer.status as number;

const { useViewerQuery: useViewerQuery2 } = load('./viewer.graphql');
const result2 = useViewerQuery2();
result2.data.viewer.status as string;
// @ts-expect-error
result2.data.viewer.status as number;

const { useViewerFromGqlQuery } = gql(`
  # import Partial from './partial.graphql'
  query ViewerFromGql {
    viewer {
      ...Partial
    }
  }
`);
const result3 = useViewerFromGqlQuery();
result3.data.viewer.status as string;
// @ts-expect-error
result3.data.viewer.status as number;
