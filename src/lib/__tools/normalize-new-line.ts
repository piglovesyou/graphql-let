const crlf = /\r\n/g;

export function normalizeNewLine(str: string) {
  if (crlf.test(str)) return str.replace(crlf, '\n');
  return str;
}
