// Fork version of do-sync
import { spawnSync, SpawnSyncOptions } from 'child_process';
import { join as pathJoin } from 'path';

export type JSONPrimitive = string | number | boolean | null | undefined;
export type JSONValue = JSONObject | JSONArray | JSONPrimitive;
export interface JSONObject extends Record<string, JSONValue> {}
export type JSONArray = JSONValue[];

type ResponseType = 'success' | 'failure';

interface Response {
  type: ResponseType;
  value: JSONValue;
}

export type Value = JSONValue;

export type AsyncFn<I extends Value[], O extends Value> = (
  ...v: I
) => Promise<O>;

const gen = (moduleFullPath: string, fnName: string, input: Value[]) => {
  return `
const fn = require('${moduleFullPath}')['${fnName}'];
if (!fn) throw new Error('${fnName} is not exported in ${moduleFullPath}');
fn(...${JSON.stringify(input)})
.then(value => console.log(JSON.stringify({ type: "success", value: value })))
.catch(e => console.log(JSON.stringify({ type: "failure", value: e })));
  `;
};

export function toSync<
  F extends (...args: any) => Promise<any>,
  I extends any[] = Parameters<F>,
  O = ReturnType<F> extends PromiseLike<infer R> ? R : never
>(
  moduleRelPath: string,
  fnName: string,
  { maxBuffer = 1000 * 1024 * 1024, ...etc }: SpawnSyncOptions = {},
): (...args: I) => O {
  const libFullDir = pathJoin(__dirname, '../..');
  const moduleFullPath = pathJoin(libFullDir, moduleRelPath);
  return (...args: I) => {
    const proc = spawnSync('node', ['-'], {
      input: gen(moduleFullPath, fnName, args),
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
