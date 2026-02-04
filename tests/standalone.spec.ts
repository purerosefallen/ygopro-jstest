import {
  OcgcoreScriptConstants,
  YGOProMsgDraw,
  YGOProMsgSelectChain,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectIdleCmd,
} from 'ygopro-msg-encode';
import { useYGOProTest } from '../src/create-ygopro-test';
import { YGOProTest } from '../src/ygopro-test';
import path from 'node:path';
import {
  SelectCardAdvancor,
  SlientAdvancor,
  SummonPlaceAdvancor,
  NoEffectAdvancor,
} from 'koishipro-core.js';
import { YGOProYrp } from 'ygopro-yrp-encode';
import { readFileSync } from 'node:fs';

describe('Standalone', () => {
  const testProcess = (ctx: YGOProTest) =>
    ctx
      .advance(SlientAdvancor())
      .state(YGOProMsgSelectIdleCmd, (msg) => {
        expect(
          ctx.allMessages.find((m) => m instanceof YGOProMsgDraw),
        ).toBeUndefined(); // make sure it does not draw any card
        const deck = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_DECK);
        expect(deck).toHaveLength(1);
        const ex = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_EXTRA);
        expect(ex).toHaveLength(1);
        const hand = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_HAND);
        expect(hand).toHaveLength(2);

        const oppHand = ctx.getFieldCard(
          1,
          OcgcoreScriptConstants.LOCATION_HAND,
        );
        expect(oppHand).toHaveLength(1);
        const c1 = hand.find((c) => c.code === 28985331);
        const c2 = hand.find((c) => c.code === 10000000);
        expect(c1).toBeDefined();
        expect(c2).toBeDefined();
        expect(c1.canSummon()).toBe(true);
        expect(c2.canSummon()).toBe(false);
        expect(c1.canActivate()).toBe(false);
        return c1.summon();
      })
      .advance(SummonPlaceAdvancor(), NoEffectAdvancor())
      .state(YGOProMsgSelectEffectYn, (msg) => {
        expect(msg.code).toBe(28985331); // check if it's the correct card effect
        return msg.prepareResponse(true);
      })
      .state(YGOProMsgSelectChain, (msg) => {
        const field = ctx.getFieldCard(1, OcgcoreScriptConstants.LOCATION_HAND);
        expect(field).toHaveLength(1);
        const c1 = field[0];
        expect(c1.code).toBe(14558127);
        expect(c1.canActivate()).toBe(true); // can activate urara
        // does not activate urara here
      })
      .advance(SlientAdvancor(), SelectCardAdvancor({ code: 5560911 }))
      .state(YGOProMsgSelectIdleCmd, (msg) => {
        const grave = ctx.getFieldCard(
          0,
          OcgcoreScriptConstants.LOCATION_GRAVE,
        );
        expect(grave).toHaveLength(1);
        expect(grave[0].code).toBe(5560911); // the deckdes monster should be in grave
        expect(grave[0].canActivate()).toBe(true);
        return grave[0].activate();
      })
      .advance(
        SummonPlaceAdvancor(),
        SelectCardAdvancor({ code: 28985331 }),
        SlientAdvancor(),
      )
      .state(YGOProMsgSelectIdleCmd, (msg) => {
        expect(ctx.getLP(0)).toBe(4000);
        const mzone = ctx.getFieldCard(
          0,
          OcgcoreScriptConstants.LOCATION_MZONE,
        );
        expect(mzone).toHaveLength(2);
        const warrior = mzone.find((c) => c.code === 28985331);
        expect(warrior.level).toBe(4);
        const dragon = mzone.find((c) => c.code === 5560911);
        expect(dragon.level).toBe(3);
        const ex = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_EXTRA);
        expect(ex).toHaveLength(1);
        expect(ex[0].code).toBe(73580471);
        expect(ex[0].canSpecialSummon()).toBe(true);
        return ex[0].specialSummon();
      })
      .advance(
        SelectCardAdvancor({ code: 5560911 }, { code: 28985331 }),
        SummonPlaceAdvancor(),
        NoEffectAdvancor(),
      )
      .state(YGOProMsgSelectEffectYn, (msg) => msg.prepareResponse(true)) // activate effect to destroy itself
      .advance(SlientAdvancor())
      .state(YGOProMsgSelectIdleCmd, (msg) => {
        const mzone = ctx.getFieldCard(
          0,
          OcgcoreScriptConstants.LOCATION_MZONE,
        );
        expect(mzone).toHaveLength(0); // destroyed
        const grave = ctx.getFieldCard(
          0,
          OcgcoreScriptConstants.LOCATION_GRAVE,
        );
        expect(grave).toHaveLength(2); // dragon returned to deck, and black rose and warrior at grave
        return;
      });

  it('Should process duel', async () => {
    await useYGOProTest(
      {
        ygoproPath: process.env.HOME + '/ygo/ygopro',
      },
      (ctx) =>
        testProcess(
          ctx.addCard([
            {
              code: 28985331,
              location: OcgcoreScriptConstants.LOCATION_HAND,
            },
            {
              code: 10000000,
              location: OcgcoreScriptConstants.LOCATION_HAND,
            },
            {
              code: 5560911,
              location: OcgcoreScriptConstants.LOCATION_DECK,
            },
            {
              code: 14558127,
              location: OcgcoreScriptConstants.LOCATION_HAND,
              controller: 1,
            },
            {
              code: 73580471,
              location: OcgcoreScriptConstants.LOCATION_EXTRA,
            },
          ]),
        ),
    );
  });
  it('Should process with puzzle', async () => {
    await useYGOProTest(
      {
        ygoproPath: process.env.HOME + '/ygo/ygopro',
        single: `
Debug.SetAIName("as")
Debug.ReloadFieldBegin(DUEL_ATTACK_FIRST_TURN)
Debug.SetPlayerInfo(0,8000,0,0)
Debug.SetPlayerInfo(1,8000,0,0)
Debug.AddCard(28985331,0,0,LOCATION_HAND,0,POS_FACEUP)
Debug.AddCard(10000000,0,0,LOCATION_HAND,0,POS_FACEUP)
Debug.AddCard(5560911,0,0,LOCATION_DECK,0,POS_FACEDOWN)
Debug.AddCard(14558127,1,1,LOCATION_HAND,0,POS_FACEUP)
Debug.AddCard(73580471,0,0,LOCATION_EXTRA,0,POS_FACEDOWN)

Debug.ReloadFieldEnd()
          `,
      },
      testProcess,
    );
  });
  it('Should process with filename puzzle', async () => {
    await useYGOProTest(
      {
        ygoproPath: process.env.HOME + '/ygo/ygopro',
        single: path.join(__dirname, 'single', 'jstest.lua'),
      },
      testProcess,
    );
  });
  it('Should process with YRP using puzzle', async () => {
    expect(
      new YGOProYrp().fromYrp(
        readFileSync(path.join(__dirname, 'standalone-test.yrp')),
      ).singleScript,
    ).toBe('jstest.lua');
    await useYGOProTest(
      {
        scriptPath: __dirname,
        yrp: path.join(__dirname, 'standalone-test.yrp'),
        ygoproPath: process.env.HOME + '/ygo/ygopro',
      },
      testProcess,
    );
  });
});
