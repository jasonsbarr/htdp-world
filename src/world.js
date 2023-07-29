import { Lib } from "@jasonsbarr/htdp-image";
import * as WorldLib from "./world-lib";

const DEFAULT_TICK_DELAY = 1 / 28;

// Corresponds to the bigBangFromDict function in the Pyret source
// see https://github.com/brownplt/code.pyret.org/blob/horizon/src/web/js/trove/world.js
// Jason: I'm doing it like this because it seems easier to have my beginning students
// pass an object into the function instead of an array, which they won't have
// seen yet the first time they encounter this function
export const bigBang = (init, dict, tracer) => {};

// Corresponds to the bigBang function in the Pyret source, see above link
export const bigBangRaw = (initW, handlers, tracer, title) => {};

class OnTick {}

class OnMouse {}

class OnKey {}

class ToDraw {}

class StopWhen {}

class CloseWhenStop {}
