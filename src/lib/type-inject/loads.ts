// export async function processLoads(
//   execContext: ExecContext,
//   sourceRelPath: string,
//   schemaHash: string,
//   gqlRelPaths: string[],
//   codegenContext: CodegenContext[],
// ) {
//   const cache = new TypeCache(execContext);
//   await cache.load();
//   const partialCache = cache.get(sourceRelPath);
//
//   const { cwd, config, cacheFullDir } = execContext;
//   const dtsRelDir = dirname(config.gqlDtsEntrypoint);
//
//   const oldGqlHashes = new Set(Object.keys(partialCache));
//
//   // Prepare
//   await Promise.all([
//     await makeDir(join(cwd, dtsRelDir)),
//     await makeDir(cacheFullDir),
//   ]);
//
//   const sourceFullPath = join(cwd, sourceRelPath);
//
//   for (const gqlRelPath of gqlRelPaths) {
//     const gqlFullPath = resolve(dirname(sourceFullPath), gqlRelPath);
//     if (!existsSync(gqlFullPath)) {
//       printError(
//         new Error(
//           `${gqlFullPath} loaded from ${sourceFullPath} not found. Skipping.`,
//         ),
//       );
//       continue;
//     }
//
//     const gqlContent = await readFile(gqlFullPath, 'utf-8');
//     if (!gqlContent) throw new Error('never');
//     const strippedGqlContent = stripIgnoredCharacters(gqlContent);
//     const gqlHash = createHash(schemaHash + strippedGqlContent);
//
//     const createdPaths = createPaths(
//       pathJoin(typesRootRelDir, sourceRelPath),
//       gqlHash,
//       dtsRelDir,
//       cacheFullDir,
//       cwd,
//     );
//
//     const context: LoadCodegenContext = {
//       ...createdPaths,
//       type: 'load-call',
//       gqlPathFragment:
//       gqlHash,
//       gqlRelPath,
//       gqlFullPath,
//       skip: Boolean(partialCache[gqlHash]),
//     };
//     codegenContext.push(context);
//
//     // Note: Non-stripped gqlContent is necessary
//     // to write dtsEntrypoint.
//     partialCache[gqlHash] = [slash(createdPaths.dtsRelPath), gqlFullPath];
//
//     // Old caches left will be removed
//     oldGqlHashes.delete(gqlHash);
//   }
//
//   // Remove old caches
//   for (const oldGqlHash of oldGqlHashes) {
//     delete partialCache[oldGqlHash];
//     const { dtsFullPath } = createPaths(
//       sourceRelPath,
//       oldGqlHash,
//       dtsRelDir,
//       cacheFullDir,
//       cwd,
//     );
//     if (existsSync(dtsFullPath)) {
//       await rimraf(dtsFullPath);
//     }
//   }
//
//   await cache.unload();
//
//   return codegenContext;
// }
//
// export const processLoadsSync = toSync(processLoads);
