const PREFIX = '[ graphql-let ]';

export function printInfo(message: string): void {
  console.info([PREFIX, message].join(' '));
}

export function printError(err: Error): void {
  console.error([PREFIX, err.message].join(' '));
}
