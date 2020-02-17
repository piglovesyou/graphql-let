function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function retryable(
  fn: () => Promise<void>,
  interval: number,
  maxTimeout: number,
) {
  if (maxTimeout < 0) throw new Error('never');
  const end = Date.now() + maxTimeout;
  let lastError: Error = new Error('never');
  while (Date.now() < end) {
    try {
      await fn();
      return;
    } catch (e) {
      console.info('Retrying...');
      lastError = e;
      await timeout(interval);
    }
  }
  throw lastError;
}
