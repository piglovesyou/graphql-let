import fs from 'fs';
import gensync from 'gensync';
import { default as _globby } from 'globby';

export const readFile = gensync({
  sync: fs.readFileSync,
  errback: fs.readFile,
});

export const writeFile = gensync({
  sync: fs.writeFileSync,
  errback: fs.writeFile,
});

export const globby = gensync({
  sync: _globby.sync,
  async: _globby,
});
