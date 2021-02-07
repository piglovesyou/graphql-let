import crypto from 'crypto';
import { EOL } from 'os';

const shouldCareNewline = EOL !== '\n';
const RegexCRLF = /\r\n/g;
function normalizeNewline(input: string | Buffer): string {
  const str = Buffer.isBuffer(input) ? input.toString() : input;
  if (shouldCareNewline) return str.replace(RegexCRLF, '\n');
  return str;
}

export function createHash(s: string | Buffer): string {
  return crypto.createHash('sha1').update(normalizeNewline(s)).digest('hex');
}

export function createHashFromBuffers(ss: (string | Buffer)[]): string {
  const hash = crypto.createHash('sha1');
  for (const s of ss) hash.update(normalizeNewline(s));
  return hash.digest('hex');
}
