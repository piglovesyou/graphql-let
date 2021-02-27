import { appendExportAsObject } from '../call-expressions/decorate-dts';
import { CodegenContext } from './types';

export function decorateDts(type: CodegenContext['type'], dtsContent: string) {
  switch (type) {
    case 'schema':
      return `${dtsContent}
 
// This is an extra code in addition to what graphql-codegen makes.
// Users are likely to use 'graphql-tag/loader' with 'graphql-tag/schema/loader'
// in webpack. This code enables the result to be typed.
import { DocumentNode } from 'graphql'
export default DocumentNode
`;
    case 'load-call':
    case 'gql-call':
      return appendExportAsObject(dtsContent);
  }
  return dtsContent;
}
