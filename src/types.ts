import { YGOProMsgResponseBase } from 'ygopro-msg-encode';

export type Advancor = (
  message: YGOProMsgResponseBase,
) => Uint8Array | null | undefined;


export interface CardLocation {
  controller: number;
  location: number;
  sequence: number;
}
