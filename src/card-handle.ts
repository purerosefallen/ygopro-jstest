import {
  BattleCmdType,
  CardQuery,
  IdleCmdType,
  YGOProMsgSelectBattleCmd,
  YGOProMsgSelectCard,
  YGOProMsgSelectChain,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectIdleCmd,
  YGOProMsgSelectSum,
  YGOProMsgSelectTribute,
  YGOProMsgSelectUnselectCard,
} from 'ygopro-msg-encode';

import { YGOProTest } from './ygopro-test';
import { pick } from 'cosmokit';
import { CardLocation } from 'koishipro-core.js';

export class CardHandle extends CardQuery implements CardLocation {
  constructor(
    public tester: YGOProTest,
    cardLocation: CardLocation,
  ) {
    super();
    Object.assign(this, cardLocation);
  }

  controller: number;
  location: number;
  sequence: number;

  getLocationInfo() {
    return pick(this, ['controller', 'location', 'sequence']);
  }

  private findSelfInList<T extends CardLocation>(
    list: T[],
    extraCondition?: Partial<T>,
  ) {
    return list.find(
      (card) =>
        card.controller === this.controller &&
        card.location === this.location &&
        card.sequence === this.sequence &&
        (!extraCondition ||
          Object.entries(extraCondition).every(
            ([key, value]) => value == null || card[key as any] === value,
          )),
    );
  }

  private canPerformAction(action: () => any) {
    try {
      action();
      return true;
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.startsWith('Unsupported current message')
      ) {
        throw e;
      }
      return false;
    }
  }

  private canPerformIdlecmdOperation(type: IdleCmdType, desc?: number) {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectIdleCmd) {
      return this.canPerformAction(() =>
        msg.prepareResponse(type, {
          ...this.getLocationInfo(),
          desc,
        }),
      );
    }
    throw new Error(`Unsupported current message ${msg?.constructor.name}`);
  }

  private idlecmdOperation(type: IdleCmdType, desc?: number) {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectIdleCmd) {
      return msg.prepareResponse(type, {
        ...this.getLocationInfo(),
        desc,
      });
    }
    throw new Error(`Unsupported current message ${msg?.constructor.name}`);
  }

  canSummon() {
    return this.canPerformIdlecmdOperation(IdleCmdType.SUMMON);
  }

  summon() {
    return this.idlecmdOperation(IdleCmdType.SUMMON);
  }

  canSpecialSummon() {
    return this.canPerformIdlecmdOperation(IdleCmdType.SPSUMMON);
  }

  specialSummon() {
    return this.idlecmdOperation(IdleCmdType.SPSUMMON);
  }

  canMset() {
    return this.canPerformIdlecmdOperation(IdleCmdType.MSET);
  }

  mset() {
    return this.idlecmdOperation(IdleCmdType.MSET);
  }

  canSset() {
    return this.canPerformIdlecmdOperation(IdleCmdType.SSET);
  }

  sset() {
    return this.idlecmdOperation(IdleCmdType.SSET);
  }

  canChangePosition() {
    return this.canPerformIdlecmdOperation(IdleCmdType.REPOS);
  }

  changePosition() {
    return this.idlecmdOperation(IdleCmdType.REPOS);
  }

  private canPerformBattlecmdOperation(type: BattleCmdType, desc?: number) {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectBattleCmd) {
      return this.canPerformAction(() =>
        msg.prepareResponse(type, {
          ...this.getLocationInfo(),
          desc,
        }),
      );
    }
    throw new Error(`Unsupported current message ${msg?.constructor.name}`);
  }

  private battlecmdOperation(type: BattleCmdType, desc?: number) {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectBattleCmd) {
      return msg.prepareResponse(type, {
        ...this.getLocationInfo(),
        desc,
      });
    }
    throw new Error(`Unsupported current message ${msg?.constructor.name}`);
  }

  canPerformAttack() {
    return this.canPerformBattlecmdOperation(BattleCmdType.ATTACK);
  }

  canDirectAttack() {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectBattleCmd) {
      return !!this.findSelfInList(msg.attackableCards, { directAttack: 1 });
    }

    throw new Error(`Unsupported current message ${msg?.constructor.name}`);
  }

  performAttack() {
    return this.battlecmdOperation(BattleCmdType.ATTACK);
  }

  activate(desc?: number) {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectIdleCmd) {
      return this.idlecmdOperation(IdleCmdType.ACTIVATE, desc);
    }
    if (msg instanceof YGOProMsgSelectBattleCmd) {
      return this.battlecmdOperation(BattleCmdType.ACTIVATE, desc);
    }
    if (msg instanceof YGOProMsgSelectChain) {
      return msg.prepareResponse({
        ...this.getLocationInfo(),
        desc,
      });
    }
    if (msg instanceof YGOProMsgSelectEffectYn) {
      if (this.findSelfInList([msg], { desc })) {
        return msg.prepareResponse(true);
      }
      throw new Error('This card is not selectable in the current message.');
    }

    throw new Error(`Unsupported current message ${msg?.constructor.name}`);
  }

  canActivate(desc?: number) {
    return this.canPerformAction(() => this.activate(desc));
  }

  canSelect() {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectCard) {
      return !!this.findSelfInList(msg.cards);
    }
    if (msg instanceof YGOProMsgSelectUnselectCard) {
      return !!this.findSelfInList([
        ...msg.selectableCards,
        ...msg.unselectableCards,
      ]);
    }
    if (msg instanceof YGOProMsgSelectTribute) {
      return !!this.findSelfInList(msg.cards);
    }
    if (msg instanceof YGOProMsgSelectSum) {
      return !!this.findSelfInList(msg.cards);
    }
    throw new Error(`Unsupported current message ${msg?.constructor.name}`);
  }

  select() {
    const msg = this.tester.lastSelectMessage;
    if (msg instanceof YGOProMsgSelectCard) {
      return msg.prepareResponse([this.getLocationInfo()]);
    }
    if (msg instanceof YGOProMsgSelectUnselectCard) {
      return msg.prepareResponse(this.getLocationInfo());
    }
    if (msg instanceof YGOProMsgSelectTribute) {
      return msg.prepareResponse([this.getLocationInfo()]);
    }
    if (msg instanceof YGOProMsgSelectSum) {
      return msg.prepareResponse([this.getLocationInfo()]);
    }
  }
}
