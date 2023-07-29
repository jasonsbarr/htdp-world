import { Lib } from "@jasonsbarr/htdp-image";
import * as WorldLib from "./world-lib";

const DEFAULT_TICK_DELAY = 1 / 28;

// Corresponds to the bigBangFromDict function in the Pyret source
// see https://github.com/brownplt/code.pyret.org/blob/horizon/src/web/js/trove/world.js
// Jason: I'm doing it like this because it seems easier to have my beginning students
// pass an object into the function instead of an array, which they won't have
// seen yet the first time they encounter this function
export const bigBang = (init, dict, tracer) => {
  let handlers = [];

  const add = (k, constr) => {
    handlers.push(new constr(dict[k]));
  };

  const title = dict.title ? dict.title : "Big Bang";

  if (dict.onTick) {
    const delay = dict.secondsPerTick
      ? dict.secondsPerTick
      : DEFAULT_TICK_DELAY;

    handlers.push(new OnTick(dict.onTick, delay * 1000));
  }

  add("onMouse", OnMouse);
  add("onKey", OnKey);
  add("toDraw", ToDraw);
  add("stopWhen", StopWhen);
  add("closeWhenStop", CloseWhenStop);

  return bigBangRaw(init, handlers, tracer, title);
};

// Corresponds to the bigBang function in the Pyret source, see above link
export const bigBangRaw = (initW, handlers, tracer, title) => {};

class OnTick {}

class OnMouse {}

class OnKey {}

class ToDraw {}

class StopWhen {}

class CloseWhenStop {}
