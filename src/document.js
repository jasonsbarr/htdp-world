let jsdom = {};
let JSDOM = function () {};

// Have to use this ugly hack to populate the jsdom value because microbundle
// doesn't support top-level await and otherwise we either have to bundle
// a bunch of Node.js modules that don't work in the browser and take
// forever to bundle anyway or else let a bad import specifier for jsdom
// crash the program when you import the main bundle.
(async () => {
  if (typeof window === "undefined") {
    jsdom = await import("jsdom");
  } else {
    jsdom = { JSDOM };
  }
})();

export const makeDocument = () => {
  let document;
  if (typeof window === "undefined") {
    const html = `<!doctype html>
<html>
  <head></head>
  <body></body>
</html>`;
    let dom;
    if (jsdom.JSDOM === undefined) {
      let interval = setInterval(() => {
        if (jsdom.JSDOM) {
          dom = new jsdom.JSDOM(html);
          document = dom.window.document;
          clearInterval(interval);
        }
      }, 100);
    } else {
      dom = new jsdom.JSDOM(html);
      document = dom.window.document;
    }
  } else {
    document = window.document;
  }

  return document;
};
