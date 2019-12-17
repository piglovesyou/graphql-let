import { Types } from "@graphql-codegen/plugin-helpers";
import { ConfigTypes } from "./types";

export type PartialCodegenOpts = Pick<Types.GenerateOptions, 'config' | 'plugins' | 'pluginMap'>;

export default function createCodegenOpts(config: ConfigTypes): PartialCodegenOpts {
  return {
    config: {
      withHOC: false,  // True by default
      withHooks: true, // False by default
    },
    plugins: config.plugins.map(name => ({ [name]: {} })),
    pluginMap: config.plugins.reduce((acc, name) => {
      let m: any;
      try {
        m = require(`@graphql-codegen/${name}`);
      } catch (e) {
        throw new Error(e);
      }
      return { ...acc, [name]: m };
    }, {}),
  };
}
