import { Advancor } from '../types';

export const DefaultResponseAdvancor = (): Advancor => {
  return (msg) => {
    return msg.defaultResponse();
  };
};
