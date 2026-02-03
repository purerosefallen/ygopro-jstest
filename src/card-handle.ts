import { CardQuery } from 'ygopro-msg-encode';
import { YGOProTest } from './ygopro-test';
import { CardLocation } from './types';

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
}
