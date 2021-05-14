import logUpdate from 'log-update';

export const PRINT_PREFIX = '[ graphql-let ] ';

export function printInfo(message: string): void {
  console.info(PRINT_PREFIX + message);
}

export function printWarning(message: string): void {
  console.warn(PRINT_PREFIX + message);
}

export function printError(err: Error): void {
  console.error(PRINT_PREFIX + err.message + '\n' + err.stack);
}

export function updateLog(message: string) {
  logUpdate(PRINT_PREFIX + message);
}

export function updateLogDone() {
  logUpdate.done();
}
