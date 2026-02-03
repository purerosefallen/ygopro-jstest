import { createDuelFromYrp, OcgcoreMessageType, OcgcoreWrapper } from 'koishipro-core.js';
import {
  OcgcoreScriptConstants,
  YGOProMsgBase,
  YGOProMsgResponseBase,
} from 'ygopro-msg-encode';
import { YGOProYrp } from 'ygopro-yrp-encode';
import { StaticAdvancor } from './advancors/static-advancor';
import { Advancor } from './types';
import { CardLocation } from './types';
import { CardHandle } from './card-handle';
import { createEvaluateScript, decodeEvaluateResult } from './utility/evaluate-script';

export class YGOProTest {
  duel = createDuelFromYrp(this.core, this.yrp).duel;
  currentResponses: Uint8Array[] = [];
  allResponses: Uint8Array[] = [];
  currentMessages: YGOProMsgBase[] = [];
  allMessages: YGOProMsgBase[] = [];
  lastSelectMessage: YGOProMsgResponseBase | null = null;

  constructor(
    public core: OcgcoreWrapper,
    public yrp: YGOProYrp,
  ) {
    this.duel.ocgcoreWrapper.setMessageHandler((duel, msg, type) => {
      if (type === OcgcoreMessageType.ScriptError) {
        throw new Error(`Script Error: ${msg}`);
      } else {
        console.log(`Debug: ${msg}`);
      }
    })
    this.advance(StaticAdvancor(this.yrp.responses));
  }

  advance(cb: Advancor | Uint8Array) {
    if (this.ended) {
      throw new Error('Duel has already ended.');
    }
    if (cb instanceof Uint8Array) {
      cb = StaticAdvancor([cb]);
    }
    this.currentResponses = [];
    this.currentMessages = [];
    while (true) {
      const result = this.duel.process();
      if (result.message) {
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

  state(cb: (ctx: this) => Advancor | Uint8Array | undefined) {
    if (this.ended) {
      throw new Error('Duel has already ended.');
    }
    const advancorOrResponse = cb(this);
    if (advancorOrResponse == null) {
      return this;
    }
    return this.advance(advancorOrResponse);
  }

  ended = false;

  end() {
    this.ended = true;
    this.duel.endDuel();
    this.duel.ocgcoreWrapper.finalize();
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
      { p: player, player, loc: s_location },
      { p: opp, player: opp, loc: o_location },
    ]) {
      for (
        let location = OcgcoreScriptConstants.LOCATION_DECK;
        location <= OcgcoreScriptConstants.LOCATION_EXTRA;
        location = location << 1
      ) {
        if ((query.loc & location) === 0) continue;
        const fieldQuery = this.duel.queryFieldCard({
          player: query.p,
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

  evaluate(script: string) {
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
    this.duel.ocgcoreWrapper.scriptReaders.pop();
    const res = this.duel.getRegistryValue(token);
    this.duel.setRegistryValue(token, '');
    if (!res) {
      throw new Error('Evaluation failed.');
    }
    return decodeEvaluateResult(this, res.text);
  }
}
