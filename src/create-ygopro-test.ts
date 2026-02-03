import initSqlJs from 'sql.js';
import { YGOProTestOptions } from './ygopro-test-options';
import {
  createOcgcoreWrapper,
  DirCardReader,
  DirScriptReader,
  DirScriptReaderEx,
  SqljsCardReader,
} from 'koishipro-core.js';
import { YGOProYrp } from 'ygopro-yrp-encode';
import { readFile } from './utility/read-file';
import { makeArray } from 'nfkit';
import { YGOProTest } from './ygopro-test';

export const createYGOProTest = async (options: YGOProTestOptions) => {
  const SQL = await initSqlJs(options.sqljsOptions);
  const ocgcore = await createOcgcoreWrapper(options.ocgcoreOptions);

  if (options.cdb) {
    const cdbs = makeArray(options.cdb);
    for (const cdb of cdbs) {
      const sqlDatabase =
        cdb instanceof SQL.Database
          ? cdb
          : new SQL.Database(await readFile(cdb));
      ocgcore.setCardReader(SqljsCardReader(sqlDatabase));
    }
  }

  if (options.scriptPath) {
    const paths = makeArray(options.scriptPath);
    for (const path of paths) {
      ocgcore.setScriptReader(DirScriptReader(path));
    }
  }

  if (options.ygoproPath) {
    const paths = makeArray(options.ygoproPath);
    for (const path of paths) {
      ocgcore.setScriptReader(await DirScriptReaderEx(path));
      ocgcore.setCardReader(await DirCardReader(SQL, path));
    }
  }

  const yrp =
    options.yrp instanceof YGOProYrp
      ? options.yrp
      : new YGOProYrp().fromYrp(await readFile(options.yrp));

  return new YGOProTest(ocgcore, yrp);
};
