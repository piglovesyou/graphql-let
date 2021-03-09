import { gql, load } from 'graphql-let/macro';

const { useViewerFromMacroQuery } = load('./viewer-from-macro.graphql');
useViewerFromMacroQuery().data.viewer.name as string;
// @ts-expect-error
useViewerFromMacroQuery() as number;

const { useViewerFromMacro2Query } = gql(`
  # import Partial from './partial.graphql'
  query ViewerFromMacro2 {
    viewer {
      ...Partial
    }
  }
`);
useViewerFromMacro2Query().data.viewer.name as string;
// @ts-expect-error
useViewerFromMacro2Query() as number;
