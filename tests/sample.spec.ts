import {
  OcgcoreCommonConstants,
  YGOProMsgResponseBase,
} from 'ygopro-msg-encode';
import { createYGOProTest } from '../src/create-ygopro-test';

describe('Sample test.', () => {
  it('should load', async () => {
    const test = await createYGOProTest({
      ygoproPath: '/home/nanahira/ygo/ygopro',
      yrp: './tests/test.yrp',
    });

    expect(test.lastSelectMessage).toBeInstanceOf(YGOProMsgResponseBase);
    expect(
      test.allMessages.filter(
        (m) => m.identifier === OcgcoreCommonConstants.MSG_NEW_TURN,
      ).length,
    ).toBe(2);

    test.end();
  });
});
