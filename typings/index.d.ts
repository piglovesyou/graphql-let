declare module 'terminate';
declare module '@babel/helper-transform-fixture-test-runner';
declare module '@babel/helper-plugin-utils';
declare module '@ardatan/sync-fetch';
declare module 'gensync' {
  interface GensyncFn<Ps = any, R = any> {
    (...args: Ps): Generator<unknown, R>;
    sync: (...args: Ps) => R;
    async: (...args: Ps) => Promise<R>;
  }
  function gensync<F extends (...args: any) => any>(obj: {
    sync: F;
    errback?: any;
    async?: any;
  }): GensyncFn<Parameters<F>, ReturnType<F>>;
  function gensync<G extends (...args: any) => Generator>(
    generator: G,
  ): GensyncFn<
    Parameters<G>,
    G extends (...args: any) => Generator<any, infer R> ? R : never
  >;
  export default gensync;
}
