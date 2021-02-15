import * as V3e81ed6254d58faa4d4bb8a12568fa59509c0acb from "./node_modules/graphql-let/__generated__/proj-root/input-3e81ed6254d58faa4d4bb8a12568fa59509c0acb.ts";
const {
  useViewerQuery
} = V3e81ed6254d58faa4d4bb8a12568fa59509c0acb;
useViewerQuery().data.viewer.id;
useViewerQuery().data.viewer.name; // @ts-expect-error

useViewerQuery().data.viewer.status; // @ts-expect-error

useViewerQuery();
