import { Types } from '@graphql-codegen/plugin-helpers/types';
import { ConfigTypes } from '../lib/config';
import { isURL } from '../lib/paths';
import { printError } from '../lib/print';

export function shouldGenResolverTypes(config: ConfigTypes): boolean {
  try {
    if (!config.schemaEntrypoint) return false;
    require('@graphql-codegen/typescript');
    require('@graphql-codegen/typescript-resolvers');
    const hasFilePointer = getSchemaPointers(config.schema!).some(
      (p) => !isURL(p),
    );
    if (!hasFilePointer) {
      printError(
        new Error(
          `To use Resolver Types, you should have at least one file in "schema".`,
        ),
      );
      return false;
    }
    return true;
  } catch (e) {
    // Just skip.
    return false;
  }
}

function getSchemaPointers(
  schema: Types.InstanceOrArray<Types.Schema>,
  _acc: string[] = [],
): string[] {
  if (typeof schema === 'string') {
    _acc.push(schema);
  } else if (Array.isArray(schema)) {
    for (const s of schema) getSchemaPointers(s, _acc);
  } else if (typeof schema === 'object') {
    for (const s of Object.keys(schema)) getSchemaPointers(s, _acc);
  }
  return _acc;
}
