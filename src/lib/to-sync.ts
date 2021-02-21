// Fork version of do-sync that runs a function within the entire .js file
import caller from 'caller';
import { spawnSync, SpawnSyncOptions } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JSONObject extends Record<string, JSONValue> {}
export type JSONPrimitive = string | number | boolean | null | undefined;
export type JSONValue = JSONObject | JSONArray | JSONPrimitive;
export type JSONArray = JSONValue[];

type ResponseType = 'success' | 'failure';

interface Response {
  type: ResponseType;
  value: JSONValue;
}

export type Value = JSONValue;

const gen = (moduleFullPath: string, fnName: string, input: Value[]) => {
  return `
const fn = require('${moduleFullPath}')['${fnName}'];
if (!fn) throw new Error('${fnName} is not exported in ${moduleFullPath}');
fn(...${JSON.stringify(input)})
.then(value => console.log(JSON.stringify({ type: "success", value: value })))
.catch(e => console.log(JSON.stringify({ type: "failure", value: e })));
  `;
};

type ToSyncOptions = SpawnSyncOptions & {
  filename?: string;
  functionName?: string;
};

type AsyncFn = (...args: any) => Promise<any>;

export function toSync<
  F extends AsyncFn,
  I extends any[] = Parameters<F>,
  O = ReturnType<F> extends PromiseLike<infer R> ? R : never
>(
  asyncFn: F,
  {
    filename = caller(),
    functionName = asyncFn.name,
    maxBuffer = 1000 * 1024 * 1024,
    ...etc
  }: ToSyncOptions = {},
): (...args: I) => O {
  if (!functionName)
    throw new Error(
      `Couldn't get function name. Use named function or please provide "functionName" in option manually.`,
    );
  return (...args: I) => {
    const proc = spawnSync('node', ['-'], {
      input: gen(filename, functionName, args),
      maxBuffer,
      ...etc,
    });

    const stderr = proc.stderr.toString('utf-8').trim();
    if (stderr) console.error(stderr);
    if (proc.error) throw proc.error;

    const rsp: Response = JSON.parse(proc.stdout.toString('utf-8'));

    if (rsp.type == 'failure') throw rsp.value;
    return rsp.value as any;
  };
}
