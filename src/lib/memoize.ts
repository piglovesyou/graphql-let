type AsyncFn = (...args: any) => Promise<any>;

/**
 * Memoizatin for async functions, which releases the cache right after the promise is resolved.
 * Intermediate calls will wait for the first one. This prevents simultaneous executions for writing the same files for an example.
 */
export default function memoize<T extends AsyncFn>(
  fn: T,
  createKey: (...args: Parameters<T>) => string,
): T {
  type TReturn = ReturnType<T>;
  const processingTasks = new Map<string, TReturn>();

  // Anyone who can type better out there?
  const memoized: any = async (...args: any) => {
    const key = createKey(...args);
    if (processingTasks.has(key)) {
      return processingTasks.get(key);
    }
    const promise = fn(...args) as ReturnType<T>;
    processingTasks.set(key, promise);
    const resolvedValue = await promise;
    processingTasks.delete(key);
    return resolvedValue;
  };

  return memoized;
}
