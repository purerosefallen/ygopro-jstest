import { YGOProMsgResponseBase } from 'ygopro-msg-encode';
import { Advancor } from '../types';

export interface DefaultAdvancorHandleObjectr<T extends YGOProMsgResponseBase> {
  msgClass: new (...args: any[]) => T;
  cb: (msg: T) => Uint8Array | undefined;
}

export const DefaultAdvancorHandler = <T extends YGOProMsgResponseBase>(
  msgClass: new (...args: any[]) => T,
  cb: (msg: T) => Uint8Array | undefined,
) => ({
  msgClass,
  cb,
});

export const DefaultAdvancor = (
  options: {
    player?: number;
    handlers?: DefaultAdvancorHandleObjectr<YGOProMsgResponseBase>[];
  } = {},
): Advancor => {
  const handlerMap = new Map<
    new (...args: any[]) => YGOProMsgResponseBase,
    (msg: YGOProMsgResponseBase) => Uint8Array | undefined
  >();
  if (options.handlers != null) {
    for (const handler of options.handlers) {
      handlerMap.set(handler.msgClass, handler.cb);
    }
  }
  return (msg) => {
    if (options.player != null && msg.responsePlayer() !== options.player) {
      return undefined;
    }
    const cb = handlerMap.get(
      msg.constructor as new (...args: any[]) => YGOProMsgResponseBase,
    );
    if (cb != null) {
      const res = cb(msg);
      if (res != null) {
        return res;
      }
    }
    return msg.defaultResponse();
  };
};
