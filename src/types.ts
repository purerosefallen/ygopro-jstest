import { YGOProMsgResponseBase } from 'ygopro-msg-encode';

export type Advancor<T extends YGOProMsgResponseBase = YGOProMsgResponseBase> =
  (message: T) => Uint8Array | null | undefined;

export interface CardLocation {
  controller: number;
  location: number;
  sequence: number;
}
