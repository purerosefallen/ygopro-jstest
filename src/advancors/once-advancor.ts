import { YGOProMsgResponseBase } from 'ygopro-msg-encode';
import { Advancor } from '../types';

export const OnceAdvancor = <T extends YGOProMsgResponseBase>(
  a: Advancor<T>,
): Advancor<T> => {
  let called = false;
  return (msg) => {
    if (called) {
      return undefined;
    }
    const res = a(msg);
    called = true;
    return res;
  };
};
