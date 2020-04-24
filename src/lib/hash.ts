import crypto from 'crypto';

export function createHash(s: string | Buffer): string {
  return crypto.createHash('sha1').update(s).digest('hex');
}
