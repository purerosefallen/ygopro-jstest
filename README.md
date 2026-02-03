# ygopro-jstest
YGOPro test utilities in JS/TS. This package wraps `koishipro-core.js` to drive OCGCore duels in Node.js, with helpers for loading YGOPro resources, replay (`.yrp`) tests, and scripted puzzles.

**Highlights**
1. Create and control duels from JS/TS.
2. Load real YGOPro resources (scripts + cards).
3. Inspect field state, drive selections, and evaluate Lua snippets.

---

## Install
```bash
npm i ygopro-jstest
```

---

## Resource Loading Priority
When you provide multiple sources, the loading priority is:
1. `cdb` and `scriptPath` (highest priority)
2. `ygoproPath` (fallback)

This means `cdb` and `scriptPath` will be used first and can override data from `ygoproPath`.

---

## Quick Start: Load From YRP (Jest)
Use a replay file for deterministic tests. The recommended entry point is `useYGOProTest`.

```ts
import {
  useYGOProTest,
  OcgcoreCommonConstants,
  OcgcoreScriptConstants,
  YGOProMsgResponseBase,
} from 'ygopro-jstest';

describe('yrp', () => {
  it('loads and inspects state', async () => {
    await useYGOProTest(
      {
        ygoproPath: '/path/to/ygopro',
        yrp: './tests/test.yrp',
      },
      (ctx) => {
        // after loading, you should already have messages processed
        expect(ctx.lastSelectMessage).toBeInstanceOf(YGOProMsgResponseBase);

        const newTurnCount = ctx.allMessages.filter(
          (m) => m.identifier === OcgcoreCommonConstants.MSG_NEW_TURN,
        ).length;
        expect(newTurnCount).toBeGreaterThan(0);

        const mzone = ctx.getFieldCard(
          0,
          OcgcoreScriptConstants.LOCATION_MZONE,
          0,
        );
        expect(mzone.length).toBeGreaterThan(0);
      },
    );
  });
});
```

---

## Load From `single` (Puzzle Script, Jest)
Use `single` to load a puzzle-like Lua script (string or `.lua` file).  
**Important:** after loading with `single`, call `SlientAdvancor()` once to advance into Main Phase 1 so the duel can start responding to selections.

```ts
import {
  useYGOProTest,
  SlientAdvancor,
  YGOProMsgSelectIdleCmd,
} from 'ygopro-jstest';

describe('single', () => {
  it('runs puzzle', async () => {
    await useYGOProTest(
      {
        ygoproPath: '/path/to/ygopro',
        single: `
Debug.ReloadFieldBegin(DUEL_ATTACK_FIRST_TURN)
Debug.SetPlayerInfo(0,8000,0,0)
Debug.SetPlayerInfo(1,8000,0,0)
Debug.AddCard(28985331,0,0,LOCATION_HAND,0,POS_FACEUP)
Debug.ReloadFieldEnd()
        `,
      },
      (ctx) =>
        ctx
          .advance(SlientAdvancor())
          .state(YGOProMsgSelectIdleCmd, (msg) => {
            // respond to idle selection
          }),
    );
  });
});
```

---

## Advanced: Create Duel Directly (Jest)
When you do not use `yrp` or `single`, you are responsible for building the field yourself. This is the most flexible mode and is the basis for the standalone specs.

```ts
import {
  useYGOProTest,
  OcgcoreScriptConstants,
  SlientAdvancor,
  SummonPlaceAdvancor,
  NoEffectAdvancor,
  YGOProMsgSelectIdleCmd,
} from 'ygopro-jstest';

describe('standalone', () => {
  it('builds field and plays', async () => {
    await useYGOProTest(
      {
        ygoproPath: '/path/to/ygopro',
      },
      (ctx) =>
        ctx
          .addCard([
            { code: 28985331, location: OcgcoreScriptConstants.LOCATION_HAND },
            { code: 10000000, location: OcgcoreScriptConstants.LOCATION_HAND },
          ])
          .advance(SlientAdvancor())
          .state(YGOProMsgSelectIdleCmd, (msg) => {
            const hand = ctx.getFieldCard(
              0,
              OcgcoreScriptConstants.LOCATION_HAND,
            );
            return hand[0].summon();
          })
          .advance(SummonPlaceAdvancor(), NoEffectAdvancor()),
    );
  });
});
```

---

## Core Concepts
### `advance(...)`
Advances the duel processing loop. It repeatedly calls `duel.process()`, and when a response is required, it invokes your advancor(s). It continues until the duel ends or no response is produced.

**Example (Jest)**
```ts
import { useYGOProTest, SlientAdvancor } from 'ygopro-jstest';

describe('advance', () => {
  it('steps to next selection', async () => {
    await useYGOProTest(
      { ygoproPath: '/path/to/ygopro', yrp: './tests/test.yrp' },
      (ctx) => {
        ctx.advance(SlientAdvancor());
        expect(ctx.lastSelectMessage).toBeDefined();
      },
    );
  });
});
```

### `state(...)`
A convenience wrapper around the last selectable message. It gives you `lastSelectMessage`, lets you generate a response or advancor, then internally calls `advance(...)` to continue.

**Important:** when you use the typed overload `state(SomeMessageClass, cb)`, it will **throw** if the current message is not an instance of that class.

**Example (Jest)**
```ts
import {
  useYGOProTest,
  YGOProMsgSelectIdleCmd,
  SlientAdvancor,
} from 'ygopro-jstest';

describe('state', () => {
  it('handles a specific message type', async () => {
    await useYGOProTest(
      { ygoproPath: '/path/to/ygopro', yrp: './tests/test.yrp' },
      (ctx) =>
        ctx
          .advance(SlientAdvancor())
          .state(YGOProMsgSelectIdleCmd, (msg) => {
            return msg.prepareResponse(0);
          }),
    );
  });
});
```

### `evaluate(script: string)`
Injects a Lua snippet into the current duel and serializes the return value back to JS.

Return value handling:
1. `Card` is serialized as `CardHandle`.
2. `Group` is serialized as `CardHandle[]`.

**Example (Jest)**
```ts
import { useYGOProTest } from 'ygopro-jstest';

describe('evaluate', () => {
  it('returns card and group', async () => {
    await useYGOProTest(
      { ygoproPath: '/path/to/ygopro', yrp: './tests/test.yrp' },
      (ctx) => {
        const result = ctx.evaluate(`
local g = Duel.GetFieldGroup(0, LOCATION_MZONE, 0)
local c = g:GetFirst()
return { card = c, group = g }
        `);
        expect(result.card).toBeDefined();
        expect(Array.isArray(result.group)).toBe(true);
      },
    );
  });
});
```

---

## API

### `useYGOProTest(options, cb)`
**Usage**
```ts
await useYGOProTest(
  { ygoproPath: '/path/to/ygopro', yrp: './tests/test.yrp' },
  (ctx) => {
    // use ctx
  },
);
```
Creates a `YGOProTest` instance and automatically calls `end()` after the callback finishes.

### `createYGOProTest(options)`
**Usage**
```ts
const test = await createYGOProTest({ ygoproPath: '/path/to/ygopro' });
```
Creates a `YGOProTest` instance directly. You must call `end()` manually.

### `YGOProTestOptions`
Loading-related fields (priority: `cdb` / `scriptPath` > `ygoproPath`):
1. `ygoproPath?: string | string[]`
2. `cdb?: string | Uint8Array | Database | Array<...>`
3. `scriptPath?: string | string[]`

Other fields:
1. `sqljsOptions?: SqlJsConfig`
2. `ocgcoreOptions?: CreateOcgcoreWrapperOptions`
3. `yrp?: string | Uint8Array | YGOProYrp`
4. `single?: string`
5. `opt?: number`
6. `playerInfo?: { startLp?: number; startHand?: number; drawCount?: number }[]`
7. `seed?: number | number[]`

### `class YGOProTest`
**Properties**
1. `currentMessages: YGOProMsgBase[]`
2. `allMessages: YGOProMsgBase[]`
3. `currentResponses: Uint8Array[]`
4. `allResponses: Uint8Array[]`
5. `lastSelectMessage: YGOProMsgResponseBase | null`
6. `ended: boolean`

**Methods**
1. `advance(...advancorsOrResponses)`

   **Usage**
   ```ts
   ctx.advance(SlientAdvancor());
   ```

2. `state(cb | (msgClass, cb))`

   **Usage**
   ```ts
   ctx.state(YGOProMsgSelectIdleCmd, (msg) => {
     return msg.prepareResponse(0);
   });
   ```

3. `evaluate(script: string): any`

   **Usage**
   ```ts
   const result = ctx.evaluate('return Duel.GetTurnPlayer()');
   ```

4. `addCard(cards)`

   **Usage**
   ```ts
   ctx.addCard({ code: 28985331, location: OcgcoreScriptConstants.LOCATION_HAND });
   ```

5. `getCard(cardLocation, forced = false)`

   **Usage**
   ```ts
   const card = ctx.getCard({ controller: 0, location: LOCATION_HAND, sequence: 0 });
   ```

6. `getFieldCard(player, selfLocations, oppLocations = 0)`

   **Usage**
   ```ts
   const hand = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_HAND);
   ```

7. `getLP(player)`

   **Usage**
   ```ts
   const lp = ctx.getLP(0);
   ```

8. `end()`

   **Usage**
   ```ts
   ctx.end();
   ```

### `class CardHandle`
A `CardHandle` is a live handle to a specific card location in the duel. Many actions return **response bytes** that you must return from `state(...)` so `advance(...)` can continue.

**Typical pattern**
```ts
ctx.state(YGOProMsgSelectIdleCmd, (msg) => {
  const hand = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_HAND);
  return hand[0].summon();
});
```

**Core fields**
1. `controller: number`
2. `location: number`
3. `sequence: number`

**Utility**
1. `getLocationInfo()`

**Idle command actions**
1. `canSummon()` / `summon()`
2. `canSpecialSummon()` / `specialSummon()`
3. `canMset()` / `mset()`
4. `canSset()` / `sset()`
5. `canChangePosition()` / `changePosition()`
6. `canActivate(desc?: number)` / `activate(desc?: number)`

**Battle command actions**
1. `canPerformAttack()` / `performAttack()`
2. `canDirectAttack()`
3. `canActivate(desc?: number)` / `activate(desc?: number)`

**Selection actions**
1. `canSelect()` / `select()`

**Important**
All action methods (`summon`, `activate`, `select`, etc.) return response bytes. Always `return` them from `state(...)`.

---

## Advancors
Advancors are small response producers. You can pass multiple advancors into `advance(...)` and they will be combined. The first one that returns a response for the current message wins.

### `SlientAdvancor()`
Calls `defaultResponse()` for any message. In practice, this auto-answers optional effect prompts with “do not activate” and is ideal for fast-forwarding.

### `NoEffectAdvancor()`
Only responds to `SelectChain` when there are **no** chains available, allowing the duel to continue. It does not auto-decline effect prompts. Use this when you want to handle effect prompts yourself via `state(...)`.

### `SummonPlaceAdvancor(placeAndPosition?)`
Auto-selects summon placement (`SelectPlace`) and position (`SelectPosition`). You can pass a partial filter to constrain player/location/sequence/position.

### `SelectCardAdvancor(...filters)`
Selects cards by matching filters (e.g., code, location, controller). Supports several message types like `SelectCard`, `SelectUnselectCard`, `SelectSum`, `SelectTribute`.

### `StaticAdvancor(items)`
Returns a fixed sequence of responses you provide. Each call consumes one item.

### `CombinedAdvancor(...advancors)`
Runs advancors in order and returns the first non-`undefined` response. This is the same combiner used by `advance(...)` internally.

### `MapAdvancor(...handlers)`
Dispatches by message class. Each handler maps a message type to an advancor function.

### `MapAdvancorHandler(msgClass, cb)`
Helper for building `MapAdvancor` handler objects.

### `LimitAdvancor(advancor, limit)`
Wraps an advancor and only allows it to return a response `limit` times.

### `OnceAdvancor(advancor)`
Shorthand for `LimitAdvancor(advancor, 1)`.

### `PlayerViewAdvancor(player, advancor)`
Runs the inner advancor only when `responsePlayer()` matches the specified player.

### Composition
You can combine advancors to form a pipeline:
```ts
ctx.advance(
  SlientAdvancor(),
  SummonPlaceAdvancor(),
  SelectCardAdvancor({ code: 28985331 }),
);
```

---

## Notes
1. This library does **not** run the full YGOPro client. It drives OCGCore logic only.
2. When using `single`, call `SlientAdvancor()` once before `state(...)` to enter Main Phase 1.
