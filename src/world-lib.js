let _worldIndex = 0;

const getNewWorldIndex = () => {
  return ++_worldIndex;
}

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
      return shutdown({errorShutdown: e});
    }
  }
}

export const shutdown = (options) => {};
