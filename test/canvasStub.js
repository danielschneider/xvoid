// Minimal 2D canvas stub for texture tests. Records every draw call and property
// assignment in order, so tests can assert on what would have been painted.
export function installCanvasStub() {
  const created = [];
  globalThis.document = {
    createElement(tag) {
      const calls = [];
      const context = new Proxy(
        {},
        {
          get(target, key) {
            if (key in target) return target[key];
            return (...args) => {
              calls.push({ op: String(key), args });
            };
          },
          set(target, key, value) {
            target[key] = value;
            calls.push({ op: 'set', key: String(key), value });
            return true;
          },
        }
      );
      const canvas = { tagName: tag, width: 0, height: 0, calls, getContext: () => context };
      created.push(canvas);
      return canvas;
    },
  };
  return {
    created,
    uninstall() {
      delete globalThis.document;
    },
  };
}
