import { OcgcoreCreateFlags } from 'koishipro-core.js';
import { YGOProTest } from '../src/ygopro-test';
import {
  analyzeLuaExecutableLines,
  LuaCoverageRegistry,
  normalizeLuaCoverageName,
} from '../index';
import { createYGOProTest, useYGOProTest } from '../src/create-ygopro-test';
import { OcgcoreScriptConstants } from 'ygopro-msg-encode';
import { ReplayHeader, YGOProYrp } from 'ygopro-yrp-encode';
import os from 'node:os';
import path from 'node:path';

const createFakeDuel = () => ({
  setPlayerInfo: jest.fn(),
  setRegistryValue: jest.fn(),
  newCard: jest.fn(),
  newTagCard: jest.fn(),
  preloadScript: jest.fn(),
  startDuel: jest.fn(),
  process: jest.fn(() => ({ status: 2, raw: new Uint8Array(0) })),
  endDuel: jest.fn(),
  getLuaCoverage: jest.fn(() => ({
    file: 'c11111111.lua',
    hits: { 1: 1, 2: 3, 5: 1 },
    coveredLines: [1, 2, 5],
  })),
  getAllLuaCoverages: jest.fn(() => ({
    'c11111111.lua': {
      file: 'c11111111.lua',
      hits: { 1: 1, 2: 3, 5: 1 },
      coveredLines: [1, 2, 5],
    },
  })),
  clearLuaCoverage: jest.fn(),
  clearAllLuaCoverages: jest.fn(),
  ocgcoreWrapper: {
    readScript: jest.fn((scriptPath: string) => {
      if (scriptPath.endsWith('c11111111.lua')) {
        return `
function c11111111.initial_effect(c)
  local x = 1
  x = x + 1
  return x
end
`;
      }
      return null;
    }),
    finalize: jest.fn(),
  },
});

const createFakeCore = () => {
  const duel = createFakeDuel();
  return {
    duel,
    core: {
      setMessageHandler: jest.fn(),
      createDuel: jest.fn(() => duel),
      createDuelV2: jest.fn(() => duel),
    },
  };
};

describe('Lua coverage API', () => {
  test('normalizes coverage names consistently', () => {
    expect(normalizeLuaCoverageName('@./script/foo/bar.lua')).toBe(
      'foo/bar.lua',
    );
    expect(normalizeLuaCoverageName('./script/foo/bar.lua')).toBe(
      'foo/bar.lua',
    );
    expect(normalizeLuaCoverageName('script/foo/bar.lua')).toBe('foo/bar.lua');
    expect(normalizeLuaCoverageName('./single/foo.lua')).toBe('single/foo.lua');
  });

  test('detects Lua executable lines with luaparse', () => {
    expect(
      analyzeLuaExecutableLines(`
function f()
  local x = 1
  if x then
    x = x + 1
  end
  return x
end
`),
    ).toEqual([2, 3, 4, 5, 7]);
  });

  test('passes coverage create flags for raw duel creation', () => {
    const { core } = createFakeCore();

    new YGOProTest(core as any, {
      coverage: true,
      seed: 123,
    });

    expect(core.createDuel).toHaveBeenCalledWith(
      123,
      OcgcoreCreateFlags.EnableLuaCoverage,
    );
  });

  test('passes coverage create flags for seed sequence duel creation', () => {
    const { core } = createFakeCore();

    new YGOProTest(core as any, {
      coverage: true,
      seed: [1, 2, 3],
    });

    expect(core.createDuelV2).toHaveBeenCalledWith(
      [1, 2, 3],
      OcgcoreCreateFlags.EnableLuaCoverage,
    );
  });

  test('passes coverage create flags for YRP duel creation', () => {
    const { core } = createFakeCore();
    const header = new ReplayHeader();
    header.seed = 456;
    const yrp = new YGOProYrp({ header, responses: [] });

    new YGOProTest(core as any, {
      coverage: true,
      yrp,
    });

    expect(core.createDuel).toHaveBeenCalledWith(
      456,
      OcgcoreCreateFlags.EnableLuaCoverage,
    );
  });

  test('adds executable line summary to getCoverage output', () => {
    const { core, duel } = createFakeCore();
    const ctx = new YGOProTest(core as any, { coverage: true, seed: 123 });

    const coverage = ctx.getCoverage('./script/c11111111.lua');

    expect(duel.getLuaCoverage).toHaveBeenCalledWith(
      './script/c11111111.lua',
    );
    expect(coverage.executableLines).toEqual([2, 3, 4, 5]);
    expect(coverage.uncoveredLines).toEqual([3, 4]);
    expect(coverage.lineCoverage).toBe(0.5);
  });

  test('summarizes getAllCoverages and clears coverage data', () => {
    const { core, duel } = createFakeCore();
    const ctx = new YGOProTest(core as any, { coverage: true, seed: 123 });

    const all = ctx.getAllCoverages();

    expect(all['c11111111.lua'].lineCoverage).toBe(0.5);
    expect(ctx.clearCoverage('c11111111.lua')).toBe(ctx);
    expect(ctx.clearAllCoverages()).toBe(ctx);
    expect(duel.clearLuaCoverage).toHaveBeenCalledWith('c11111111.lua');
    expect(duel.clearAllLuaCoverages).toHaveBeenCalled();
  });

  test('merges coverage in LuaCoverageRegistry', () => {
    const registry = new LuaCoverageRegistry();

    registry
      .add({ './script/c11111111.lua': { 2: 1, 4: 1 } })
      .add({
        'c11111111.lua': {
          file: 'c11111111.lua',
          hits: { 2: 3, 5: 1 },
          coveredLines: [2, 5],
        },
      });

    expect(registry.files()).toEqual(['c11111111.lua']);
    expect(registry.has('./script/c11111111.lua')).toBe(true);
    expect(registry.getCoverage('c11111111.lua')).toEqual({
      file: 'c11111111.lua',
      hits: { 2: 4, 4: 1, 5: 1 },
      coveredLines: [2, 4, 5],
    });
    expect(registry.toJSON()).toEqual({
      files: {
        'c11111111.lua': { 2: 4, 4: 1, 5: 1 },
      },
    });
  });

  test('records setup script coverage in real wasm', async () => {
    const test = await createYGOProTest({
      coverage: true,
      ygoproPath: path.join(os.homedir(), 'ygo', 'ygopro'),
      seed: 123,
    });
    try {
      const result = test.evaluate(`
local x = 1
x = x + 1
return x
`);

      const all = test.getAllCoverages();
      const evalFile = Object.keys(all).find((file) =>
        file.startsWith('__eval_token_'),
      );

      expect(result).toBe(2);
      expect(evalFile).toBeDefined();
      expect(all[evalFile!].coveredLines.length).toBeGreaterThan(0);
    } finally {
      test.end();
    }
  });

  test('records card script coverage in a real duel flow', async () => {
    await useYGOProTest(
      {
        coverage: true,
        ygoproPath: path.join(os.homedir(), 'ygo', 'ygopro'),
      },
      (ctx) => {
        ctx.addCard({
          code: 28985331,
          location: OcgcoreScriptConstants.LOCATION_HAND,
        });

        const coverage = ctx.getCoverage('c28985331.lua');

        expect(coverage.coveredLines.length).toBeGreaterThan(0);
        expect(coverage.executableLines?.length ?? 0).toBeGreaterThan(0);
      },
    );
  });
});
