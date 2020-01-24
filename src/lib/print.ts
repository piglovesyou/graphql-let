export const PREFIX = '[ graphql-let ] ';

export function printInfo(message: string): void {
  console.info(PREFIX + message);
}

export function printError(err: Error): void {
  console.error(PREFIX + err.message);
}
