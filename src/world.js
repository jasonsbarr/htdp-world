import { Lib } from "@jasonsbarr/htdp-image";
import * as WorldLib from "./world-lib.js";
import { makeDocument } from "./document.js";

const DEFAULT_TICK_DELAY = 1 / 28;
const document = makeDocument();

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
export const bigBangRaw = (initW, handlers, tracer, title) => {
  let closeBigBangWindow = null;
  let outerTopLevelNode = document.createElement("span");

  outerTopLevelNode.style.padding = "0px";
  document.body.appendChild(outerTopLevelNode);

  let topLevelNode = document.createElement("span");

  topLevelNode.style.padding = "0px";
  outerTopLevelNode.appendChild(topLevelNode);
  topLevelNode.tabIndex = 1;
  topLevelNode.focus();

  let configs = [];
  let isOutputConfigSeen = false;
  let closeWhenStop = false;

  for (let handler of handlers) {
    if (handler instanceof CloseWhenStop) {
      closeWhenStop = handler.isClose;
    } else if (handler instanceof WorldConfigOption) {
      configs.push(handler.toRawHandler(topLevelNode));
    } else {
      configs.push(handler);
    }

    if (handler instanceof OutputConfig) {
      isOutputConfigSeen = true;
    }
  }

  if (!isOutputConfigSeen) {
    configs.push(new DefaultDrawingOutput().toRawHandler(topLevelNode));
  }

  return WorldLib.bigBang(
    topLevelNode,
    initW,
    configs,
    {},
    // figure out what to do with these success and failure functions
    (finalWorldValue) => finalWorldValue,
    (err) => err,
    {
      closeWhenStop,
      closeBigBangWindow,
      tracer,
    },
  );
};

class WorldConfigOption {
  constructor(name) {
    this.name = name;
  }

  configure(config) {
    throw new Error("Unimplemented WorldConfigOption");
  }

  toDOMNode(params) {
    let span = document.createElement("span");

    span.append(document.createTextNode(`(${this.name} ...)`));
    return span;
  }

  toDisplayedString(cache) {
    return `(${this.name} ...)`;
  }

  toWrittenString(cache) {
    return `(${this.name} ...)`;
  }
}

const isWorldConfigOption = (v) => v instanceof WorldConfigOption;

class OutputConfig {}

class DefaultDrawingOutput {}

class OnTick {}

class OnMouse {}

class OnKey {}

class ToDraw {}

class StopWhen {}

class CloseWhenStop {}
