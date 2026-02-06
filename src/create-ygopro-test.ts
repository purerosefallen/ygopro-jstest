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
import { Awaitable, makeArray } from 'nfkit';
import { YGOProTest } from './ygopro-test';

export const createYGOProTest = async (options: YGOProTestOptions) => {
  const SQL = await initSqlJs(options.sqljsOptions);
  const ocgcore = await createOcgcoreWrapper(options.ocgcoreOptions);

  if (options.cdb) {
    const cdbs = makeArray(options.cdb);
    for (const cdb of cdbs) {
      if (cdb instanceof SQL.Database) {
        ocgcore.setCardReader(SqljsCardReader(cdb));
      } else {
        const buf = await readFile(cdb);
        ocgcore.setCardReader(SqljsCardReader(SQL, buf));
      }
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

  let yrp: YGOProYrp | undefined;
  let single: string | undefined;
  if (options.yrp) {
    yrp =
      options.yrp instanceof YGOProYrp
        ? options.yrp
        : new YGOProYrp().fromYrp(await readFile(options.yrp));
  } else if (options.single != null) {
    const isPath = options.single.endsWith('.lua');
    single = isPath
      ? Buffer.from(await readFile(options.single)).toString('utf-8')
      : options.single;
  }

  return new YGOProTest(ocgcore, {
    yrp,
    single,
    opt: options.opt,
    playerInfo: options.playerInfo,
    seed: options.seed,
  });
};

export const useYGOProTest = async (
  options: YGOProTestOptions,
  cb: (test: YGOProTest) => Awaitable<any>,
) => {
  const test = await createYGOProTest(options);
  try {
    await cb(test);
  } finally {
    test.end();
  }
};
