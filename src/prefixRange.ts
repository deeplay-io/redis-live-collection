export function makePrefixRange(prefix: string | Buffer): [Buffer, Buffer] {
  if (typeof prefix === 'string') {
    prefix = Buffer.from(prefix);
  }

  const min = Buffer.concat([Buffer.from('['), prefix], prefix.length + 1);
  const max = Buffer.concat(
    [Buffer.from('('), strInc(prefix)],
    prefix.length + 1,
  );

  return [min, max];
}

// Credit: https://github.com/josephg/node-foundationdb/blob/v1.0.0/lib/util.ts#L4
function strInc(buf: Buffer): Buffer {
  let lastNonFFByte: number;
  for (lastNonFFByte = buf.length - 1; lastNonFFByte >= 0; --lastNonFFByte) {
    if (buf[lastNonFFByte] != 0xff) break;
  }

  if (lastNonFFByte < 0) {
    throw new Error(
      `invalid argument: prefix must have at least one byte not equal to 0xFF`,
    );
  }

  const result = Buffer.alloc(lastNonFFByte + 1);
  buf.copy(result, 0, 0, result.length);
  ++result[lastNonFFByte];

  return result;
}
