const PREFIX = '[graphql-let]';

export function printInfo(...messages: string[]): void {
  console.info.apply([PREFIX, ...messages]);
}

export function printError(err: Error): void {
  console.error.apply([PREFIX, err.message].join(' '));
}
