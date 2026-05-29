import { OcgcoreScriptConstants } from 'ygopro-msg-encode';
import { useYGOProTest } from '../src/create-ygopro-test';
import os from 'node:os';
import path from 'node:path';

describe('addCard', () => {
  const options = {
    ygoproPath: path.join(os.homedir(), 'ygo', 'ygopro'),
  };

  it('places MZONE cards in the first unused sequence when omitted', async () => {
    await useYGOProTest(options, (ctx) => {
      ctx.addCard([
        {
          code: 28985331,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
          sequence: 2,
        },
        {
          code: 10000000,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
        },
        {
          code: 5560911,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
        },
      ]);

      expect(
        ctx.getCard({
          controller: 0,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
          sequence: 0,
        })?.code,
      ).toBe(10000000);
      expect(
        ctx.getCard({
          controller: 0,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
          sequence: 1,
        })?.code,
      ).toBe(5560911);
      expect(
        ctx.getCard({
          controller: 0,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
          sequence: 2,
        })?.code,
      ).toBe(28985331);
    });
  });

  it('uses the controller field when picking SZONE sequence', async () => {
    await useYGOProTest(options, (ctx) => {
      ctx.addCard([
        {
          code: 28985331,
          controller: 1,
          location: OcgcoreScriptConstants.LOCATION_SZONE,
          sequence: 0,
        },
        {
          code: 10000000,
          location: OcgcoreScriptConstants.LOCATION_SZONE,
        },
        {
          code: 5560911,
          controller: 1,
          location: OcgcoreScriptConstants.LOCATION_SZONE,
        },
      ]);

      expect(
        ctx.getCard({
          controller: 0,
          location: OcgcoreScriptConstants.LOCATION_SZONE,
          sequence: 0,
        })?.code,
      ).toBe(10000000);
      expect(
        ctx.getCard({
          controller: 1,
          location: OcgcoreScriptConstants.LOCATION_SZONE,
          sequence: 1,
        })?.code,
      ).toBe(5560911);
    });
  });

  it('throws when no field sequence is available', async () => {
    await useYGOProTest(options, (ctx) => {
      for (let sequence = 0; sequence <= 4; sequence++) {
        ctx.addCard({
          code: 28985331,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
          sequence,
        });
      }

      expect(() =>
        ctx.addCard({
          code: 10000000,
          location: OcgcoreScriptConstants.LOCATION_MZONE,
        }),
      ).toThrow(/No available sequence/);
    });
  });
});
