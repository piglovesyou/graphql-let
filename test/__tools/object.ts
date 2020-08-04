import { deepStrictEqual } from 'assert';

export function assertObjectInclude(
  actual: Record<string, any>,
  expect: Record<string, any>,
) {
  for (const k of Object.keys(expect)) {
    deepStrictEqual(actual[k], expect[k]);
  }
}

export function assertObjectsInclude(
  actuals: Record<string, any>[],
  expects: Record<string, any>[],
) {
  deepStrictEqual(actuals.length, expects.length);
  for (const [i, expect] of expects.entries()) {
    assertObjectInclude(actuals[i], expect);
  }
}
