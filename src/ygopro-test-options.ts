import { CreateOcgcoreWrapperOptions } from 'koishipro-core.js';
import { MayBeArray } from 'nfkit';
import { Database, SqlJsConfig } from 'sql.js';
import { YGOProYrp } from 'ygopro-yrp-encode';

export interface YGOProTestOptions {
  ygoproPath?: MayBeArray<string>;
  cdb?: MayBeArray<string | Uint8Array | Database>;
  scriptPath?: MayBeArray<string>;
  sqljsOptions?: SqlJsConfig;
  ocgcoreOptions?: CreateOcgcoreWrapperOptions;
  yrp: string | Uint8Array | YGOProYrp;
}
