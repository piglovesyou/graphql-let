import { Types } from '@graphql-codegen/plugin-helpers';
import { ConfigTypes } from './config';

export type PartialCodegenOpts = Pick<Types.GenerateOptions, 'config'>;

export default function createCodegenOpts(
  config: ConfigTypes,
): PartialCodegenOpts {
  return {
    config: {
      withHOC: false, // True by default
      withHooks: true, // False by default
      ...config.config,
    },
  };
}
