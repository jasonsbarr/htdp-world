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

  return bigBangRaw(init, handlers, tracer);
};

// Corresponds to the bigBang function in the Pyret source, see above link
export const bigBangRaw = (initW, handlers, tracer) => {
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

  // The Pyret source has an option for a default toDraw handler here, but
  // we're going to make them explicitly provide a toDraw handler

  return WorldLib.bigBang(
    topLevelNode,
    initW,
    configs,
    {},
    // figure out what to do with these success and failure functions
    (finalWorldValue) => finalWorldValue,
    (err) => {
      throw err;
    },
    {
      closeWhenStop,
      closeBigBangWindow,
      tracer,
    },
  );
};

export class WorldConfigOption {
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

export const isWorldConfigOption = (v) => v instanceof WorldConfigOption;

/**
 * Takes a JavaScript function and converts it to the CPS style function
 * WorldLib expects. Not sure how to do this since JS doesn't
 * have support for continuations in any form.
 */
export const adaptWorldFunction = (worldFunction) => {
  return (...args) => {
    const success = args[args.length - 1];
    const jsArgs = args.slice(0, -1);

    try {
      const world = worldFunction(...jsArgs);
      success(world);
    } catch (e) {
      WorldLib.shutdown({ errorShutdown: e });
    }
  };
};

class OnTick extends WorldConfigOption {
  constructor(handler, delay) {
    super("onTick");
    this.handler = handler;
    this.delay = delay;
  }

  toRawHandler(topLevelNode) {
    const that = this;
    const worldFunction = adaptWorldFunction(that.handler);

    return WorldLib.onTick(this.delay, worldFunction);
  }
}

class OnMouse extends WorldConfigOption {
  constructor(handler) {
    super("onMouse");
    this.handler = handler;
  }

  toRawHandler(topLevelNode) {
    const that = this;
    const worldFunction = adaptWorldFunction(that.handler);

    return WorldLib.onMouse((w, x, y, type, success) => {
      worldFunction(w, x, y, type, success);
    });
  }
}

class OnKey extends WorldConfigOption {
  constructor(handler) {
    super("onKey");
    this.handler = handler;
  }

  toRawHandler(topLevelNode) {
    const that = this;
    const worldFunction = adaptWorldFunction(that.handler);

    return WorldLib.onKey((w, e, success) => {
      worldFunction(w, getKeyCodeName(e), success);
    });
  }
}

const getKeyCodeName = (e) => {
  const code = e.charCode || e.keyCode;
  let keyname;
  switch (code) {
    case 8:
      keyname = "backspace";
      break;
    case 9:
      keyname = "tab";
      break;
    case 13:
      keyname = "enter";
      break;
    case 16:
      keyname = "shift";
      break;
    case 17:
      keyname = "control";
      break;
    case 19:
      keyname = "pause";
      break;
    case 27:
      keyname = "escape";
      break;
    case 33:
      keyname = "prior";
      break;
    case 34:
      keyname = "next";
      break;
    case 35:
      keyname = "end";
      break;
    case 36:
      keyname = "home";
      break;
    case 37:
      keyname = "left";
      break;
    case 38:
      keyname = "up";
      break;
    case 39:
      keyname = "right";
      break;
    case 40:
      keyname = "down";
      break;
    case 42:
      keyname = "print";
      break;
    case 45:
      keyname = "insert";
      break;
    case 46:
      keyname = "delete";
      break;
    case 106:
      keyname = "*";
      break;
    case 107:
      keyname = "+";
      break;
    case 109:
      keyname = "-";
      break;
    case 110:
      keyname = ".";
      break;
    case 111:
      keyname = "/";
      break;
    case 144:
      keyname = "numlock";
      break;
    case 145:
      keyname = "scroll";
      break;
    case 186:
      keyname = ";";
      break;
    case 187:
      keyname = "=";
      break;
    case 188:
      keyname = ",";
      break;
    case 189:
      keyname = "-";
      break;
    case 190:
      keyname = ".";
      break;
    case 191:
      keyname = "/";
      break;
    case 192:
      keyname = "`";
      break;
    case 219:
      keyname = "[";
      break;
    case 220:
      keyname = "\\";
      break;
    case 221:
      keyname = "]";
      break;
    case 222:
      keyname = "'";
      break;
    default:
      if (code >= 96 && code <= 105) {
        keyname = (code - 96).toString();
      } else if (code >= 112 && code <= 123) {
        keyname = "f" + (code - 111);
      } else {
        keyname = String.fromCharCode(code).toLowerCase();
      }
      break;
  }

  return keyname;
};

class OutputConfig extends WorldConfigOption {
  constructor(name) {
    super(name);
  }
}

class ToDraw extends OutputConfig {
  constructor(handler) {
    super("toDraw");
    this.handler = handler;
  }

  toRawHandler(topLevelNode) {
    let reusableCanvas;
    let reusableCanvasNode;
    const adaptedWorldFunction = adaptWorldFunction(this.handler);

    const worldFunction = (world, success) => {
      adaptedWorldFunction(world, (image) => {
        const drawImage = (image) => {
          const width = image.width;
          const height = image.height;

          if (!reusableCanvas) {
            reusableCanvas = Lib.makeCanvas(width, height);

            // Note: the canvas object may itself manage objects,
            // as in the case of an excanvas.  In that case, we must make
            // sure jsworld doesn't try to disrupt its contents!
            reusableCanvas.jsworldOpaque = true;
            reusableCanvasNode = WorldLib.nodeToTree(reusableCanvas);

            if (reusableCanvas.width !== width) {
              reusableCanvas.width = width;
            }

            if (reusableCanvas.height !== height) {
              reusableCanvas.height = height;
            }

            const ctx = reusableCanvas.getContext("2d");

            ctx.save();
            ctx.fillStyle = "rgba(255, 255, 255, 1)";
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            image.render(ctx, 0, 0);
            success([topLevelNode, reusableCanvasNode]);
          }
        };

        if (image instanceof Lib.FileImage || image instanceof Lib.FileVideo) {
          if (image.isLoaded) {
            drawImage(image);
            return;
          }

          let interval = setInterval(() => {
            if (image.isLoaded) {
              drawImage(image);
              clearInterval(interval);
            }
          }, 100);
        } else {
          drawImage(image);
        }
      });
    };

    const cssFunction = (w, k) => {
      if (reusableCanvas) {
        k([
          [
            reusableCanvas,
            ["padding", "0px"],
            ["width", reusableCanvas.width + "px"],
            ["height", reusableCanvas.height + "px"],
          ],
        ]);
      } else {
        k([]);
      }
    };

    return WorldLib.onDraw(worldFunction, cssFunction);
  }
}

class CloseWhenStop {
  /**
   * Constructor
   * @param {boolean} isClose
   */
  constructor(isClose) {
    super("closeWhenStop");
    this.isClose = isClose;
  }
}

const isCloseWhenStopConfig = (v) => v instanceof CloseWhenStop;

class StopWhen extends WorldConfigOption {
  constructor(handler) {
    super("stopWhen");
    this.handler = handler;
  }

  toRawHandler(topLevelNode) {
    const that = this;
    const worldFunction = adaptWorldFunction(that.handler);

    return WorldLib.stopWhen(worldFunction);
  }
}

export const onTick = (handler) =>
  new OnTick(handler, Math.floor(DEFAULT_TICK_DELAY * 1000));

export const onTickN = (handler, n) => new OnTick(handler, n * 1000);

export const toDraw = (drawer) => new ToDraw(drawer);

export const stopWhen = (stopper) => new StopWhen(stopper);

export const closeWhenStop = (isClose) => new CloseWhenStop(isClose);

export const onKey = (handler) => new OnKey(handler);

export const onMouse = (handler) => new OnMouse(handler);

export const isKeyEqual = (key1, key2) =>
  key1.toLowerCase() === key2.toLowerCase();
