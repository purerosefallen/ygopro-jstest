import fs from 'node:fs';

export const readFile = async (
  pathOrBinary: Uint8Array | string,
): Promise<Uint8Array> => {
  if (typeof pathOrBinary === 'string') {
    return fs.promises.readFile(pathOrBinary);
  }
  return pathOrBinary;
};
