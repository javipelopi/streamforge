import '@testing-library/jest-dom/vitest';

// Mock window.matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver for jsdom - call callback with mock dimensions
global.ResizeObserver = class ResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    // Immediately call callback with mock dimensions
    // This allows TanStack Virtual to work in jsdom
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            bottom: 600,
            right: 800,
            x: 0,
            y: 0,
            toJSON: () => {},
          },
          borderBoxSize: [{ inlineSize: 800, blockSize: 600 }],
          contentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
          devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
        } as ResizeObserverEntry,
      ],
      this
    );
  }

  unobserve() {}
  disconnect() {}
};

// Mock Element.getBoundingClientRect for jsdom
Element.prototype.getBoundingClientRect = function () {
  return {
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  };
};

// Mock scrollHeight, scrollWidth, clientHeight, clientWidth
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  configurable: true,
  get() {
    return 10000;
  },
});

Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
  configurable: true,
  get() {
    return 10000;
  },
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return 600;
  },
});

Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get() {
    return 800;
  },
});
