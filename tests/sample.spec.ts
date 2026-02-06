import {
  OcgcoreCommonConstants,
  OcgcoreScriptConstants,
  YGOProMsgResponseBase,
} from 'ygopro-msg-encode';
import { createYGOProTest } from '../src/create-ygopro-test';
import os from 'node:os';
import path from 'node:path';

describe('Sample test.', () => {
  it('should load', async () => {
    const test = await createYGOProTest({
      ygoproPath: path.join(os.homedir(), 'ygo', 'ygopro'),
      yrp: './tests/test.yrp',
    });

    expect(test.lastSelectMessage).toBeInstanceOf(YGOProMsgResponseBase);
    expect(
      test.allMessages.filter(
        (m) => m.identifier === OcgcoreCommonConstants.MSG_NEW_TURN,
      ).length,
    ).toBe(2);

    const mzone = test.getFieldCard(
      0,
      OcgcoreScriptConstants.LOCATION_MZONE,
      0,
    );
    expect(mzone).toHaveLength(2);
    expect(mzone[0].attack).toBeGreaterThan(0);

    expect(test.getLP(0)).toBe(8000);
    expect(test.getLP(1)).toBe(8000);

    test.end();
  });
});
