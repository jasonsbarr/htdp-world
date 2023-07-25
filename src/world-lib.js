let _worldIndex = 0;

const getNewWorldIndex = () => {
  return ++_worldIndex;
};

// These contents are adapted from Chris King's JSWorld as revised by Ethan Cechetti in summer 2010

/* Type signature notation
 * CPS(a b ... -> c) is used to denote
 *    a b ... (c -> void) -> void
 */

let currentFocusedNode = false;

export const doNothing = () => {};

// forEachK: CPS( array CPS(array -> void) (error -> void) -> void )
// Iterates through an array and applies f to each element using CPS
// If an error is thrown, it catches the error and calls f_error on it

/**
 * Executes a function on each item in an array, CPS
 * @param {Array} a
 * @param {Function} f
 * @param {Function} f_error
 * @param {Function} k
 * @returns {any}
 */
const forEachK = (a, f, f_error, k) => {
  const forEachHelp = (i) => {
    if (i >= a.length) {
      if (k) {
        return k();
      } else {
        return;
      }
    }

    try {
      return f(a[i], () => forEachHelp(i + 1));
    } catch (e) {
      return shutdown({ errorShutdown: f_error(e) });
    }
  };

  return forEachHelp(0);
};

// WORLD STUFFS

class InitialWorld {}

let world = new InitialWorld();
let worldListenersStack = [];
let eventDetachersStack = [];
let worldIndexStack = [];
let runningBigBangs = [];

let worldIndex = null;
let worldListeners = null;
let eventDetachers = null;
let changingWorld = [];

const clearRunningState = () => {
  worldIndexStack = [];
  worldIndex = null;
  world = new InitialWorld();
  worldListenersStack = [];
  worldListeners = null;

  eventDetachersStack.forEach((eventDetachers) => {
    eventDetachers.forEach((eventDetatcher) => {
      eventDetatcher();
    });
  });

  eventDetachersStack = [];
  eventDetachers = null;
  changingWorld = [];
};

export const shutdown = (options) => {};
