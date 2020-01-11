import crypto from 'crypto';

export default function getHash(s: string | Buffer): string {
  return crypto
    .createHash('sha1')
    .update(s)
    .digest('hex');
}
