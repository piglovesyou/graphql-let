import { existsSync } from 'fs';
import { basename, dirname, join as pathJoin } from 'path';
import slash from 'slash';
import { ExecContext } from '../exec-context';
import { readFile, statSync, writeFile } from '../file';

/**
 * Cache manager for literal GraphQL documents as gql(`query {}`).
 *
 * Shape of the object storage:
 *   {
 *     "sourceRelPath.tsx": {
 *       "gqlHash1": ["sourceRelPath-gqlHash1.d.ts", "query {\n ... \n}"]
 *       "gqlHash2": ["sourceRelPath-gqlHash2.d.ts", "query {\n ... \n}"],
 *     }
 *   }
 *
 * The reason the leading "sourceRelPath.tsx" is to make it easier
 * to take care of old caches.
 */
export type PartialCacheStore = {
  [gqlHash: string]: [/*dtsRelPath*/ string, /*gqlContent*/ string];
};

export type ProjectCacheStore = {
  [tsxRelPath: string]: PartialCacheStore;
};

export class LiteralCache {
  storeFullPath: string;
  dtsEntrypointFullPath: string;
  projectStore: ProjectCacheStore | null = null;
  lastModified: number | null = null;
  constructor(execContext: ExecContext) {
    const { cwd, config } = execContext;
    this.dtsEntrypointFullPath = pathJoin(cwd, config.gqlDtsEntrypoint);
    this.storeFullPath = pathJoin(
      cwd,
      dirname(config.gqlDtsEntrypoint),
      'store.json',
    );
  }
  async load() {
    if (existsSync(this.storeFullPath)) {
      this.lastModified = statSync(this.storeFullPath).mtimeMs;
      const content = await readFile(this.storeFullPath, 'utf-8');
      this.projectStore = JSON.parse(content);
    } else {
      this.projectStore = Object.create(null);
    }
  }
  get(sourceRelPath: string): PartialCacheStore {
    if (!this.projectStore) throw new Error('boom');
    return (
      this.projectStore[sourceRelPath] ||
      (this.projectStore[sourceRelPath] = Object.create(null))
    );
  }
  async unload() {
    if (!this.projectStore) throw new Error('never');
    if (
      existsSync(this.storeFullPath) &&
      statSync(this.storeFullPath).mtimeMs !== this.lastModified
    )
      throw new Error('something wrong.');

    // Update store.json
    await writeFile(
      this.storeFullPath,
      JSON.stringify(this.projectStore, null, 2),
    );

    // Update index.d.ts
    const accumulator = new Map<string, [string, string]>();
    for (const sourceRelPath of Object.keys(this.projectStore)) {
      const partial = this.projectStore[sourceRelPath];
      for (const hash of Object.keys(partial)) {
        const [dtsRelPath, gqlContent] = partial[hash];
        accumulator.set(hash, [dtsRelPath, gqlContent]);
      }
    }
    let dtsEntrypointContent = '';
    for (const [hash, [dtsRelPath, gqlContent]] of accumulator) {
      // For TS2691
      const dtsRelPathWithoutExtension = slash(
        pathJoin(dirname(dtsRelPath), basename(dtsRelPath, '.d.ts')),
      );
      dtsEntrypointContent += `import T${hash} from './${dtsRelPathWithoutExtension}';
export default function gql(gql: \`${gqlContent}\`): T${hash}.__GraphQLLetTypeInjection;
`;
    }
    await writeFile(this.dtsEntrypointFullPath, dtsEntrypointContent);

    // Invalidate the instance
    this.projectStore = null;
  }
}
