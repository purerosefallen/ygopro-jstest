import {
  OcgcoreScriptConstants,
  YGOProMsgDraw,
  YGOProMsgSelectCard,
  YGOProMsgSelectChain,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectIdleCmd,
  YGOProMsgSelectPlace,
  YGOProMsgSelectPosition,
  YGOProMsgSelectSum,
} from 'ygopro-msg-encode';
import { DefaultResponseAdvancor, NoEffectAdvancor } from '../src/advancors';
import { useYGOProTest } from '../src/create-ygopro-test';
import { YGOProTest } from '../src/ygopro-test';

describe('Standalone', () => {
  const testProcess = (ctx: YGOProTest) =>
    ctx
      .advance(DefaultResponseAdvancor())
      .state(YGOProMsgSelectIdleCmd, (msg) => {
        expect(
          ctx.allMessages.find((m) => m instanceof YGOProMsgDraw),
        ).toBeUndefined(); // make sure it does not draw any card
        const hand = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_HAND);
        expect(hand).toHaveLength(2);
        const c1 = hand.find((c) => c.code === 28985331);
        const c2 = hand.find((c) => c.code === 10000000);
        expect(c1).toBeDefined();
        expect(c2).toBeDefined();
        expect(c1.canSummon()).toBe(true);
        expect(c2.canSummon()).toBe(false);
        expect(c1.canActivate()).toBe(false);
        return c1.summon();
      })
      .state(YGOProMsgSelectPlace, (msg) =>
        msg.prepareResponse([
          {
            player: 0,
            location: OcgcoreScriptConstants.LOCATION_MZONE,
            sequence: 1,
          },
        ]),
      )
      .advance(NoEffectAdvancor())
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
      .advance(DefaultResponseAdvancor())
      .state(YGOProMsgSelectCard, (msg) =>
        msg.prepareResponse([{ code: 5560911 }]),
      )
      .advance(DefaultResponseAdvancor())
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
      .advance(DefaultResponseAdvancor())
      .state(
        YGOProMsgSelectCard,
        (msg) => msg.prepareResponse([{ code: 28985331 }]), // pick the warrior on field
      )
      .advance(DefaultResponseAdvancor())
      .state(YGOProMsgSelectPlace, (msg) =>
        msg.prepareResponse([
          {
            player: 0,
            location: OcgcoreScriptConstants.LOCATION_MZONE,
            sequence: 2,
          },
        ]),
      )
      .state(YGOProMsgSelectPosition, (msg) =>
        msg.prepareResponse(OcgcoreScriptConstants.POS_FACEUP_DEFENSE),
      )
      .advance(DefaultResponseAdvancor())
      .state(YGOProMsgSelectIdleCmd, (msg) => {
        expect(ctx.getLP(0)).toBe(4000);
        const mzone = ctx.getFieldCard(
          0,
          OcgcoreScriptConstants.LOCATION_MZONE,
        );
        expect(mzone).toHaveLength(2);
        const warrior = mzone.find((c) => c.code === 28985331);
        expect(warrior.level).toBe(4);
        expect(warrior.position).toBe(OcgcoreScriptConstants.POS_FACEUP_ATTACK);
        const dragon = mzone.find((c) => c.code === 5560911);
        expect(dragon.level).toBe(3);
        expect(dragon.position).toBe(OcgcoreScriptConstants.POS_FACEUP_DEFENSE);
        const ex = ctx.getFieldCard(0, OcgcoreScriptConstants.LOCATION_EXTRA);
        expect(ex).toHaveLength(1);
        expect(ex[0].code).toBe(73580471);
        expect(ex[0].canSpecialSummon()).toBe(true);
        return ex[0].specialSummon();
      })
      .state(YGOProMsgSelectCard, (msg) =>
        msg.prepareResponse([{ code: 5560911 }]),
      )
      .state(YGOProMsgSelectSum, (msg) =>
        msg.prepareResponse([{ code: 28985331 }]),
      )
      .state(YGOProMsgSelectPlace, (msg) =>
        msg.prepareResponse([
          {
            player: 0,
            location: OcgcoreScriptConstants.LOCATION_MZONE,
            sequence: 3,
          },
        ]),
      )
      .state(YGOProMsgSelectPosition, (msg) =>
        msg.prepareResponse(OcgcoreScriptConstants.POS_FACEUP_ATTACK),
      )
      .advance(NoEffectAdvancor())
      .state(YGOProMsgSelectEffectYn, (msg) => msg.prepareResponse(true)) // activate effect to destroy itself
      .advance(DefaultResponseAdvancor())
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
        ygoproPath: '/home/nanahira/ygo/ygopro',
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
});
