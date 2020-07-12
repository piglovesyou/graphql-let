import crypto from 'crypto';

export function createHash(s: string | Buffer): string {
  return crypto
    .createHash('sha1')
    .update((Buffer.isBuffer(s) ? s.toString() : s).replace(/\r\n/g, '\n'))
    .digest('hex');
}
