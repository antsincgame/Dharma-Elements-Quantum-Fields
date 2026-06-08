// A tiny environment-neutral event emitter (browser + Node, zero-dependency).
// Deliberately NOT Node's built-in `events` module, which would break in the
// browser. The Generator mixes this in so the UI can subscribe to measurement
// progress without any framework.

export class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this._handlers.get(event);
    if (set) set.delete(fn);
  }

  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        // A failing listener must never abort the generation loop.
        if (typeof console !== 'undefined') console.error('[qiwg] listener error', err);
      }
    }
  }
}
