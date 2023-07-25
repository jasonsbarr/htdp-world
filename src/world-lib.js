import { makeDocument } from "@jasonsbarr/htdp-image";

const document = makeDocument();

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

/**
 * Preorder traversal
 */
const preorder = (node, f) => {
  f(node, () => {
    let child = node.firstChild;
    let nextSibling;

    while (child) {
      nextSibling = child.nextSibling;
      preorder(child, f);
      child = nextSibling;
    }
  });
};

/**
 * nodeEq: node node -> boolean
 * Returns true if the two nodes should be the same.
 */
const nodeEq = (node1, node2) => node1 && node2 && node1 === node2;

/**
 * isMemq: X (arrayof X) -> boolean
 * Produces true if any of the elements of L are nodeEq to x.
 */
const isMemq = (x, L) => {
  return !!L.find((n) => nodeEq(x, n));
};

/**
 * If any node cares about the world, send it in.
 */
const refreshNodeValues = (nodes) => {
  for (let node of nodes) {
    if (node.onWorldChange) {
      node.onWorldChange(world);
    }
  }
};

/**
 * update_dom(nodes(Node), relations(Node)) = void
 */
const updateDOM = (toplevelNode, nodes, relations) => {
  // move all children to their proper parents
  for (let rel of relations) {
    if (rel.relation === "parent") {
      const parent = rel.parent;
      const child = rel.child;

      if (!nodeEq(child.parentNode, parent)) {
        parent.appendChild(child);
      }
    }
  }

  // arrange siblings in proper order
  // yes, this really is bubble sort
  let unsorted = true;
  while (unsorted) {
    unsorted = false;
    for (rel of relations) {
      if (rel.relation === "neighbor") {
        const left = rel.left;
        const right = rel.right;

        if (!nodeEq(left.nextSibling, right)) {
          left.parentNode.insertBefore(left, right);
          unsorted = true;
        }
      }
    }
  }

  // Finally, remove nodes that shouldn't be attached anymore.
  const nodesPlus = nodes.concat([toplevelNode]);

  preorder(toplevelNode, (aNode, continueTraversalDown) => {
    if (aNode.jsworldOpaque) {
      if (!isMemq(aNode, nodesPlus)) {
        aNode.parentNode.removeChild(aNode);
      }
    } else {
      continueTraversalDown();
    }
  });

  refreshNodeValues(nodes);
};

/**
 * camelCase: string -> string
 * Converts lisp-case to camelCase
 */
const camelCase = (name) => name.replace(/\-(.)/g, (_, l) => l.toUpperCase());

const setCSSAttribs = (node, attribs) => {
  for (let attrib of attribs) {
    node.style[camelCase(attrib.attrib)] = attrib.values.join(" ");
  }
};

/**
 * isMatchingCssSelector: node css -> boolean
 * Returns true if the CSS selector matches.
 */
const isMatchingCSSSelector = (node, css) => {
  if (css.id.match(/^\./)) {
    // Check to see if we match the class
    return (
      node.className && member(node.className.split(/\s+/), css.id.substring(1))
    );
  }
};

// according to note in original, we shouldn't be clearing CSS
const clearCSS = doNothing;

const updateCSS = (nodes, css) => {
  for (let node of nodes) {
    // right now this does nothing
    if (!node.jsworldOpaque) {
      clearCSS(node);
    }
  }

  // set CSS
  for (let c of css) {
    if (c.id) {
      for (let node of nodes) {
        if (isMatchingCSSSelector(node, c)) {
          setCSSAttribs(node, c.attribs);
        }
      }
    } else {
      setCSSAttribs(c.node, c.attribs);
    }
  }
};

const doRedraw = (
  world,
  oldWorld,
  toplevelNode,
  redrawFunc,
  redrawCSSFunc,
  k,
) => {
  if (oldWorld instanceof InitialWorld) {
    // simple path
    redrawFunc(world, (drawn) => {
      const t = sexp2tree(drawn);
      const ns = nodes(t);

      redrawCSSFunc(world, (css) => {
        updateCSS(ns, sexp2css(css));
        updateDOM(toplevelNode, ns, relations(t));
        k();
      });
    });
  } else {
    maintainingSelection((k2) => {
      redrawFunc(world, (newRedraw) => {
        redrawCSSFunc((newRedrawCss) => {
          const t = sexp2tree(newRedraw);
          const ns = nodes(t);
          // Try to save the current selection and preserve it across DOM updates
          updateCSS(ns, sexp2css(newRedrawCss));
          updateDOM(toplevelNode, ns, relations(t));
          k2();
        });
      });
    });
  }
};

class FocusedSelection {
  constructor() {
    this.focused = currentFocusedNode;
    this.selectionStart = currentFocusedNode.selectionStart;
    this.selectionEnd = currentFocusedNode.selectionEnd;
  }

  restore() {
    if (this.focused.parentNode) {
      this.focused.selectionStart = this.selectionStart;
      this.focused.selectionEnd = this.selectionEnd;
      this.focused.focus();
    } else if (this.focused.id) {
      const matching = document.getElementById(this.focused.id);
      if (matching) {
        matching.selectionStart = this.selectionStart;
        matching.selectionEnd = this.selectionEnd;
        matching.focus();
      }
    }
  }
}

const hasCurrentFocusedSelection = () => {
  return currentFocusedNode !== undefined;
};

const getCurrentFocusedSelection = () => {
  return new FocusedSelection();
};

const maintainingSelection = (f, k) => {
  if (hasCurrentFocusedSelection()) {
    const currentFocusedSelection = getCurrentFocusedSelection();
    f(() => {
      currentFocusedSelection.restore();
      k();
    });
  } else {
    f(() => {
      k();
    });
  }
};

//////////////////////////////////////////////////////////////////////

class BigBangRecord {
  constructor(top, world, handlerCreators, handlers, attribs, success, fail) {
    this.top = top;
    this.world = world;
    this.handlers = handlers;
    this.handlerCreators = handlerCreators;
    this.attribs = attribs;
    this.success = success;
    this.fail = fail;
  }

  pause() {
    for (let handler of this.handlers) {
      if (!(handler instanceof StopWhenHandler)) {
        handler.onUnregister(this.top);
      }
    }
  }

  restart() {
    for (let handler of handlers) {
      if (!(handler instanceof StopWhenHandler)) {
        handler.onRegister(this.top);
      }
    }
  }
}

// Notes: bigBang maintains a stack of activation records; it should be possible
// to call bigBang re-entrantly.
// top: dom
// init_world: any
// handlerCreators: (Arrayof (-> handler))
// k: any -> void

export const bigBang = (
  top,
  initWorld,
  handlerCreators,
  attribs,
  succ,
  fail,
  extras,
) => {
  let thisWorldIndex = getNewWorldIndex();
  worldIndexStack.push(thisWorldIndex);
  worldIndex = thisWorldIndex;

  // Construct a fresh set of the handlers
  const handlers = map(handlerCreators, (x) => x(thisWorldIndex));

  if (runningBigBangs.length > 0) {
    runningBigBangs[runningBigBangs.length - 1].pause();
  }

  changingWorld.push(false);
  worldListeners = [];
  worldListenersStack.push(worldListeners);
  eventDetachers = [];
  eventDetachersStack.push(eventDetachers);

  // Create an activation record for this big bang
  const activationRecord = new BigBangRecord(
    top,
    initWorld,
    handlerCreators,
    handlers,
    attribs,
    succ,
    fail,
  );

  runningBigBangs.push(activationRecord);

  const keepRecordUpToDate = (w, oldW, k2) => {
    activationRecord.world = w;
    k2();
  };

  addWorldListener(keepRecordUpToDate);

  if (typeof extras.tracer === "function") {
    addWorldListener(extras.tracer);
  }

  // Monitor for termination and register the other handlers
  let stopWhen = new StopWhenHandler(
    (w, k2) => {
      k2(false);
    },
    (w, k2) => {
      k2(w);
    },
  );

  for (let handler of handlers) {
    if (handler instanceof StopWhenHandler) {
      stopWhen = handler;
    }
  }

  activationRecord.restart();

  const watchForTermination = (w, oldW, k2) => {
    if (thisWorldIndex !== worldIndex) {
      return;
    }
    stopWhen.test(w, (stop) => {
      if (!stop) {
        k2();
      } else {
        if (extras.closeWhenStop) {
          if (extras.closeBigBangWindow) {
            extras.closeBigBangWindow();
          }

          shutdownSingle({ cleanShutdown: true });
        } else {
          activationRecord.pause();
        }
      }
    });
  };

  addWorldListener(watchForTermination);

  // Finally, begin the big-bang
  copyAttribs(top, attribs);
  changeWorld((w, k2) => {
    k2(initWorld);
  }, doNothing);
};

/**
 * onTick: number CPS(world -> world) -> handler
 */
export const onTick = (delay, tick) => {
  return (thisWorldIndex) => {
    const ticker = {
      watchId: -1,
      onRegister(top) {
        scheduleTick(delay);
      },
      onUnregister(top) {
        if (ticker.watchId) {
          clearTimeout(ticker.watchId);
        }
      },
    };

    const scheduleTick = (t) => {
      ticker.watchId = setTimeout(() => {
        if (thisWorldIndex !== worldIndex) {
          return;
        }

        ticker.watchId = undefined;
        const startTime = Date.now();

        changeWorld(tick, () => {
          const endTime = Date.now();
          scheduleTick(Math.max(delay - (endTime - startTime), 0));
        });
      }, t);
    };

    return ticker;
  };
};

export const onKey = (press) => {
  return (thisWorldIndex) => {
    const wrappedPress = (e) => {
      if (thisWorldIndex !== worldIndex) {
        return;
      }

      if (e.keyCode === 27) {
        // Escape events are handled by the environment, not the world
        return;
      }

      stopPropagation(e);
      preventDefault(e);
      changeWorld((w, k) => {
        press(w, e, k);
      }, doNothing);
    };

    return {
      onRegister(top) {
        top.tabIndex = 1;
        top.focus();
        attachEvent(top, "keydown", wrappedPress);
      },
      onUnregister(top) {
        detachEvent(top, "keydown", wrappedPress);
      },
    };
  };
};

class StopWhenHandler {}
