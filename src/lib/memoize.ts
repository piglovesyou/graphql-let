type AsyncFn = (...args: any) => Promise<any>;

/**
 * Short time memoization for async function to prevent simultaneous calls
 * between the first call and its promise resolution. In the below example,
 * 2nd and 3rd call returns the value that the 1st call resolves.
 *
 *    |------.------.------|----------->
 *   1st    2nd    3rd    1st
 *  call   call   call   call resolved
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
