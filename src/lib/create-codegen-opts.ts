import { Types } from '@graphql-codegen/plugin-helpers';
import { ConfigTypes } from './config';

export type PartialCodegenOpts = Pick<Types.GenerateOptions, 'config'>;

export default async function createCodegenOpts(
  config: ConfigTypes,
): Promise<PartialCodegenOpts> {
  return {
    config: {
      withHOC: false, // True by default
      withHooks: true, // False by default
      ...config.config,
    },
  };
}
