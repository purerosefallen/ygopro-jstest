import {
  Advancor,
  CardLocation,
  CombinedAdvancor,
  createDuelFromYrp,
  OcgcoreDuel,
  OcgcoreMessageType,
  OcgcoreWrapper,
  StaticAdvancor,
} from 'koishipro-core.js';
import {
  CardData,
  OcgcoreScriptConstants,
  YGOProMsgAnnounceCard,
  YGOProMsgBase,
  YGOProMsgResponseBase,
} from 'ygopro-msg-encode';
import { YGOProYrp } from 'ygopro-yrp-encode';
import { CardHandle } from './card-handle';
import {
  createEvaluateScript,
  decodeEvaluateResult,
} from './utility/evaluate-script';
import { formatSnapshot } from './utility/format-snapshot';
import { makeArray, MayBeArray } from 'nfkit';
import { YGOProTestRuntimeOptions } from './ygopro-test-options';

export class YGOProTest {
  duel: OcgcoreDuel;
  currentResponses: Uint8Array[] = [];
  allResponses: Uint8Array[] = [];
  currentMessages: YGOProMsgBase[] = [];
  allMessages: YGOProMsgBase[] = [];
  lastSelectMessage: YGOProMsgResponseBase | null = null;
  private errors: string[] = [];

  constructor(
    private core: OcgcoreWrapper,
    private options: {
      yrp?: YGOProYrp;
      single?: string;
    } & YGOProTestRuntimeOptions = {},
  ) {
    this.core.setMessageHandler((duel, msg, type) => {
      if (type === OcgcoreMessageType.ScriptError) {
        this.errors.push(msg);
      } else {
        console.log(`Debug: ${msg}`);
      }
    });
    this.createDuel();
    this.checkScriptErrors();
  }

  private createDuelFromYrp() {
    this.duel = createDuelFromYrp(this.core, this.options.yrp!).duel;
    this.advance(StaticAdvancor(this.options.yrp!.responses));
  }

  private createDuelFromRaw() {
    this.duel =
      typeof this.options.seed === 'number'
        ? this.core.createDuel(this.options.seed)
        : this.core.createDuelV2(
            this.options.seed ??
              (() => {
                const seeds: number[] = [];
                for (let i = 0; i < 8; i++) {
                  seeds.push(Math.floor(Math.random() * 0x100000000));
                }
                return seeds;
              })(),
          );
    [0, 1].forEach((player) =>
      this.duel.setPlayerInfo({
        player,
        lp: this.options.playerInfo?.[player]?.startLp ?? 8000,
        startHand: this.options.playerInfo?.[player]?.startHand ?? 0,
        drawCount: this.options.playerInfo?.[player]?.drawCount ?? 0,
      }),
    );
    if (this.options.single) {
      this.evaluate(this.options.single);
    }
    this.duel.startDuel(this.options.opt ?? 0);
    // this.advance(NoEffectAdvancor());
  }

  private createDuel() {
    if (this.options.yrp) {
      this.createDuelFromYrp();
    } else {
      this.createDuelFromRaw();
    }
  }

  private checkScriptErrors() {
    if (!this.errors.length) return;
    const msg = this.errors.map((e) => `Script Error: ${e}`).join('\n');
    this.errors = [];
    throw new Error(msg);
  }

  advance(..._cb: (Advancor | Uint8Array)[]) {
    if (this.ended) {
      throw new Error('Duel has already ended.');
    }
    const cb = CombinedAdvancor(
      ..._cb.map((c) => (c instanceof Uint8Array ? StaticAdvancor(c) : c)),
    );
    // this.currentResponses = [];
    // this.currentMessages = [];
    if (this.lastSelectMessage) {
      const resp = cb(this.lastSelectMessage);
      if (!resp) {
        // that means the caller does not want to respond
        return this;
      }
      this.lastSelectMessage = null;
      this.duel.setResponse(resp);
    }
    while (true) {
      const result = this.duel.process();
      this.checkScriptErrors();
      if (result.raw.length && result.message) {
        this.currentMessages.push(result.message);
      }
      if (result.status === 2) {
        this.ended = true;
        break;
      } else if (result.status === 1 && result.raw.length) {
        if (!(result.message instanceof YGOProMsgResponseBase)) {
          throw new Error(
            `Expected response message, but got ${result.message?.constructor.name}.`,
          );
        }
        const response = cb(result.message as YGOProMsgResponseBase);
        if (!response) {
          break;
        }
        this.currentResponses.push(response);
        this.duel.setResponse(response);
      }
    }
    this.allMessages.push(...this.currentMessages);
    this.allResponses.push(...this.currentResponses);
    const lastMessage = this.currentMessages[this.currentMessages.length - 1];
    if (lastMessage instanceof YGOProMsgResponseBase) {
      this.lastSelectMessage = lastMessage;
    }
    return this;
  }

  private clearCurrentMessages() {
    this.currentMessages = [];
    this.currentResponses = [];
  }

  state(
    cb: (
      msg: YGOProMsgResponseBase,
    ) => Advancor | Uint8Array | undefined | void,
  ): this;
  state<M extends YGOProMsgResponseBase>(
    msgClass: new (...args: any[]) => M,
    cb: (msg: M) => Advancor | Uint8Array | undefined | void,
  ): this;
  state(
    arg1:
      | ((
          msg: YGOProMsgResponseBase,
        ) => Advancor | Uint8Array | undefined | void)
      | (new (...args: any[]) => YGOProMsgResponseBase),
    arg2?: (
      msg: YGOProMsgResponseBase,
    ) => Advancor | Uint8Array | undefined | void,
  ) {
    const snapshot = this.querySnapshot();
    const msgName =
      this.lastSelectMessage?.constructor?.name ??
      String(this.lastSelectMessage);
    const snapshotText = formatSnapshot(snapshot, (code) =>
      this.duel.ocgcoreWrapper.readCard(code),
    );
    console.log(`Current message: ${msgName}\n${snapshotText}`);
    const advanceFrom = (
      advancorOrResponse: Advancor | Uint8Array | undefined | void,
    ) => {
      this.clearCurrentMessages();
      if (advancorOrResponse == null) {
        return this;
      }
      return this.advance(advancorOrResponse as any);
    };
    if (typeof arg1 === 'function' && arg2 == null) {
      const advancorOrResponse = (
        arg1 as (
          msg: YGOProMsgResponseBase,
        ) => Advancor | Uint8Array | undefined | void
      )(this.lastSelectMessage);
      return advanceFrom(advancorOrResponse);
    }
    const msgClass = arg1 as new (...args: any[]) => YGOProMsgResponseBase;
    const cb = arg2!;
    if (!(this.lastSelectMessage instanceof msgClass)) {
      throw new Error(
        `Expected message of type [${msgClass.name}], but got [${(this.lastSelectMessage as YGOProMsgResponseBase)?.constructor.name || this.lastSelectMessage}].`,
      );
    }
    const advancorOrResponse = cb(
      this.lastSelectMessage as YGOProMsgResponseBase,
    );
    return advanceFrom(advancorOrResponse);
  }

  ended = false;

  end() {
    this.ended = true;
    this.duel.endDuel();
    this.duel.ocgcoreWrapper.finalize();
  }

  addCard(
    card: MayBeArray<{
      code: number;
      location: number;
      controller?: number;
      sequence?: number;
      position?: number;
      owner?: number;
    }>,
  ) {
    const cards = makeArray(card);
    for (const card of cards) {
      this.duel.newCard({
        code: card.code,
        location: card.location,
        owner: card.owner ?? card.controller ?? 0,
        player: card.controller ?? 0,
        sequence: card.sequence ?? 0,
        position:
          card.position ??
          (card.location &
          (OcgcoreScriptConstants.LOCATION_MZONE |
            OcgcoreScriptConstants.LOCATION_GRAVE |
            OcgcoreScriptConstants.LOCATION_REMOVED)
            ? OcgcoreScriptConstants.POS_FACEUP_ATTACK
            : OcgcoreScriptConstants.POS_FACEDOWN_DEFENSE),
      });
      this.checkScriptErrors();
    }
    return this;
  }

  getCard(cardLocation: CardLocation, forced = false) {
    const card = new CardHandle(this, cardLocation);
    const cardQuery = this.duel.queryCard({
      player: cardLocation.controller,
      location: cardLocation.location,
      sequence: cardLocation.sequence,
      queryFlag: 0xefffff,
    });
    if (!cardQuery?.card || cardQuery.card.empty) {
      if (!forced) return undefined;
      card.empty = true;
      return card;
    }
    Object.assign(card, cardQuery.card);
    return card;
  }

  getFieldCard(player: number, s_location: number, o_location: number = 0) {
    const opp = 1 - player;
    const res: CardHandle[] = [];
    for (const query of [
      { player, loc: s_location },
      { player: opp, loc: o_location },
    ]) {
      for (
        let location = OcgcoreScriptConstants.LOCATION_DECK;
        location <= OcgcoreScriptConstants.LOCATION_EXTRA;
        location = location << 1
      ) {
        if ((query.loc & location) === 0) continue;
        const fieldQuery = this.duel.queryFieldCard({
          player: query.player,
          location,
          queryFlag: 0xefffff,
        });
        const cards = fieldQuery.cards;
        if (!cards?.length) continue;
        for (let i = 0; i < fieldQuery.cards.length; i++) {
          const cardData = fieldQuery.cards[i];
          if (!cardData || cardData.empty) continue;
          const card = new CardHandle(this, {
            controller: query.player,
            location,
            sequence: i,
          });
          Object.assign(card, cardData);
          res.push(card);
        }
      }
    }
    return res;
  }

  querySnapshot() {
    const cards = this.getFieldCard(0, 0xff, 0xff).map((card) => {
      const cardInfo = this.duel.ocgcoreWrapper.readCard(card.code ?? 0);
      return {
        ...card,
        tester: undefined,
        name: cardInfo?.name ?? null,
      } as Partial<CardHandle> & { name: string | null };
    });
    const fieldInfo = this.duel.queryFieldInfo();
    const lp = fieldInfo.field.players.map((player) => player.lp);
    const chains = fieldInfo.field.chains;
    return {
      cards,
      lp,
      chains,
    };
  }

  evaluate<T = any>(script: string): T {
    // generate a unique token
    const token = `__eval_token_${Date.now()}_${Math.random()}__`;
    const injectScript = createEvaluateScript(script, token);
    this.duel.ocgcoreWrapper.setScriptReader((path: string) => {
      if (path.includes(token + '.lua')) {
        return injectScript;
      }
      return undefined;
    });
    this.duel.preloadScript(`./script/${token}.lua`);
    this.checkScriptErrors();
    this.duel.ocgcoreWrapper.scriptReaders.pop();
    const res = this.duel.getRegistryValue(token);
    this.duel.setRegistryValue(token, '');
    if (!res) {
      throw new Error('Evaluation failed.');
    }
    return decodeEvaluateResult(this, res.text);
  }

  getLP(player: number) {
    const info = this.duel.queryFieldInfo();
    return info.field.players[player].lp;
  }

  canDeclareCard(code: number, opcodes: number[] | YGOProMsgAnnounceCard) {
    if (opcodes instanceof YGOProMsgAnnounceCard) {
      opcodes = opcodes.opcodes;
    }
    const card = this.duel.ocgcoreWrapper.readCard(code);
    if (!card) {
      return false;
    }
    return new CardData().fromPartial(card).isDeclarable(opcodes);
  }
}
