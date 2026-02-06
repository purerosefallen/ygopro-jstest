import { OcgcoreScriptConstants } from 'ygopro-msg-encode';
import { createYGOProTest } from '../src/create-ygopro-test';
import os from 'node:os';
import path from 'node:path';

describe('Evaluate script.', () => {
  it('should serialize supported values', async () => {
    const test = await createYGOProTest({
      ygoproPath: path.join(os.homedir(), 'ygo', 'ygopro'),
      yrp: './tests/test.yrp',
    });

    const result = test.evaluate(`
local g = Duel.GetFieldGroup(0, LOCATION_MZONE, 0)
local c = g:GetFirst()
return {
  str = "hello",
  num = 42.5,
  bool = true,
  arr = { 1, "two", false },
  obj = { a = 1, b = "two" },
  empty = {},
  card = c,
  group = g,
  unsupported = function() end,
  nested = { { 1 }, { a = "b" } },
}
`);

    expect(result.str).toBe('hello');
    expect(result.num).toBe(42.5);
    expect(result.bool).toBe(true);
    expect(result.arr).toEqual([1, 'two', false]);
    expect(result.obj).toEqual({ a: 1, b: 'two' });
    expect(result.empty).toEqual([]);
    expect(result.unsupported).toBeUndefined();
    expect(result.nested).toEqual([[1], { a: 'b' }]);

    expect(Array.isArray(result.group)).toBe(true);
    expect(result.group.length).toBeGreaterThan(0);

    const first = result.group[0];
    expect(first.controller).toBe(0);
    expect(first.location).toBe(OcgcoreScriptConstants.LOCATION_MZONE);
    expect(first.attack ?? 0).toBeGreaterThan(0);

    expect(result.card).toBeDefined();
    expect(result.card.controller).toBe(0);
    expect(result.card.location).toBe(OcgcoreScriptConstants.LOCATION_MZONE);
    expect(result.card.attack ?? 0).toBeGreaterThan(0);

    test.end();
  });

  it('should serialize nil as null', async () => {
    const test = await createYGOProTest({
      ygoproPath: path.join(os.homedir(), 'ygo', 'ygopro'),
      yrp: './tests/test.yrp',
    });

    const result = test.evaluate(`
return nil
`);

    expect(result).toBeNull();

    test.end();
  });

  it('should throw on script error', async () => {
    const test = await createYGOProTest({
      ygoproPath: path.join(os.homedir(), 'ygo', 'ygopro'),
      yrp: './tests/test.yrp',
    });

    try {
      expect(() =>
        test.evaluate(`
-- intentional lua syntax error
local a =
return a
`),
      ).toThrow(/Script Error:/);
    } finally {
      test.end();
    }
  });
});
