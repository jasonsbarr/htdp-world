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
      f_error(e);
      return shutdown({ errorShutdown: e });
    }
  };

  return forEachHelp(0);
};

//
// WORLD STUFFS
//

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

const resumeRunningState = () => {
  worldIndexStack.pop();

  if (worldIndexStack.length > 0) {
    world = runningBigBangs[runningBigBangs.length - 1];
  } else {
    world = new InitialWorld();
  }

  eventDetachersStack.pop().forEach((eventDetacher) => {
    eventDetacher();
  });

  if (eventDetachersStack.length > 0) {
    eventDetachers = eventDetachersStack[eventDetachersStack.length - 1];
  } else {
    eventDetachers = null;
  }

  changingWorld.pop();

  if (runningBigBangs.length > 0) {
    runningBigBangs[runningBigBangs.length - 1].restart();
  }
};

/**
 * @typedef {{cleanShutdown: boolean}|{errorShutdown: any}} ShutdownOptions
 */
/**
 * Close all world computations
 * @param {ShutdownOptions} options
 */
export const shutdown = (options) => {
  while (runningBigBangs.length > 0) {
    let currentRecord = runningBigBangs.pop();

    currentRecord.pause();

    if (options.cleanShutdown) {
      currentRecord.success(world);
    }

    if (options.errorShutdown) {
      currentRecord.fail(options.errorShutdown);
    }
  }

  clearRunningState();
};

/**
 * Closes the most recent world computation
 * @param {ShutdownOptions} options
 */
export const shutdownSingle = (options) => {
  if (runningBigBangs.length > 0) {
    let currentRecord = runningBigBangs.pop();

    currentRecord.pause();

    if (options.cleanShutdown) {
      currentRecord.success(world);
    }

    if (options.errorShutdown) {
      currentRecord.fail(options.errorShutdown);
    }
  }
};

const addWorldListener = (listener) => {
  if (worldListeners === null) {
    worldListeners = [];
  }

  worldListeners.push(listener);
};

const removeWorldListener = (listener) => {
  const index = worldListeners.findIndex((l) => l === listener);

  if (index !== -1) {
    worldListeners.splice(index, 1);
  }
};

// If we're in the middle of a change_world, delay.
const DELAY_BEFORE_RETRY = 10;

// change_world: CPS( CPS(world -> world) -> void )
// Adjust the world, and notify all listeners.
export const changeWorld = (updater, k) => {
  // Check to see if we're in the middle of changing
  // the world already.  If so, put on the queue
  // and exit quickly.
  if (changingWorld[changingWorld.length - 1]) {
    setTimeout(() => {
      changeWorld(updater, k);
    }, DELAY_BEFORE_RETRY);

    return;
  }

  changingWorld[changingWorld.length - 1] = true;

  const originalWorld = world;
  const changeWorldHelp = () => {
    forEachK(
      worldListeners,
      (listener, k2) => {
        listener(world, originalWorld, k2);
      },
      (e) => {
        changingWorld[changingWorld.length - 1] = false;
        world = originalWorld;
        throw e;
      },
      () => {
        changingWorld[changingWorld.length - 1] = false;
        k();
      },
    );
  };

  try {
    updater(world, (newWorld) => {
      world = newWorld;
      changeWorldHelp();
    });
  } catch (e) {
    changingWorld[changingWorld.length - 1] = false;
    world = originalWorld;
    return shutdown({ errorShutdown: e });
  }
};

/**
 * Maps the values of an array to output values
 * @param {Array} a
 * @param {Function} f
 */
const map = (a, f) => {
  return a.map(f);
};

/**
 * Maps and concatenates
 *
 * Is this the same as a.flatMap(f, 1)?
 * @param {Array} a
 * @param {Function} f
 */
const concatMap = (a, f) => {
  let b = [];

  for (let item of a) {
    b = b.concat(f(item));
  }

  return b;
};

const member = (a, x) => {
  return !!a.find((item) => item === x);
};

//
// DOM UPDATING STUFFS
//

// tree(N): { node: N, children: [tree(N)] }
// relation(N): { relation: 'parent', parent: N, child: N } | { relation: 'neighbor', left: N, right: N }
// relations(N): [relation(N)]
// nodes(N): [N]
// css(N): [css_node(N)]
// css_node(N): { node: N, attribs: attribs } | { className: string, attribs: attribs }
// attrib: { attrib: string, values: [string] }
// attribs: [attrib]

/**
 * node_to_tree: dom -> dom-tree
 * Given a native dom node, produces the appropriate tree.
 */
export const nodeToTree = (domNode) => {
  let result = [domNode];
  let c = domNode.firstChild;

  if (c === undefined) {
    return result;
  }

  for (c = domNode.firstChild; c != null; c = c.nextSibling) {
    result.push(nodeToTree(c));
  }

  return result;
};

// nodes(tree(N)) = nodes(N)
const nodes = (tree) => {
  if (tree.node?.jsworldOpaque === true) {
    return [tree.node];
  }

  let ret = [tree.node];

  for (let child of tree.children) {
    ret = ret.concat(nodes(child));
  }

  return ret;
};

// relations(tree(N)) = relations(N)
const relations = (tree) => {
  let ret = [];

  for (let child of tree.children) {
    ret.push({ relation: "parent", parent: tree.node, child: child.node });
  }

  for (let i = 0; i < tree.children.length - 1; i++) {
    ret.push({
      relation: "neighbor",
      left: tree.children[i].node,
      right: tree.children[i + 1].node,
    });
  }

  if (!tree.node.jsworldOpaque) {
    for (let child of tree.children) {
      ret = ret.concat(relations(child));
    }
  }

  return ret;
};
