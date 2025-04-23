// Setup file for Jest environment
import '@testing-library/jest-dom';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    pathname: '/',
    asPath: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
    },
    push: jest.fn(),
    prefetch: jest.fn(() => Promise.resolve()),
  }),
}));

// Mock MediaStream and related objects
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'MediaStream', {
    writable: true,
    value: jest.fn().mockImplementation((tracks) => ({
      addTrack: jest.fn(),
      removeTrack: jest.fn(),
      getTracks: jest.fn(() => tracks || []),
      getVideoTracks: jest.fn(() => []),
      getAudioTracks: jest.fn(() => []),
    })),
  });

  window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = jest.fn();
}

// Enhanced WebSocket mock
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public onopen: ((this: WebSocket, ev: Event) => any) | null = null;
  public onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
  public onerror: ((this: WebSocket, ev: Event) => any) | null = null;
  public onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
  public readyState: number = MockWebSocket.CONNECTING;
  public url: string;
  public binaryType: string = 'blob';
  public extensions: string = '';
  public protocol: string = '';
  
  public send = jest.fn();
  public close = jest.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) this.onclose.call(this as any, new CloseEvent('close', { code, reason }));
    }, 50);
  });
  
  public addEventListener = jest.fn();
  public removeEventListener = jest.fn();
  
  constructor(url: string | URL, protocols?: string | string[]) {
    this.url = url.toString();
    if (protocols && !Array.isArray(protocols)) {
      this.protocol = protocols;
    } else if (Array.isArray(protocols) && protocols.length > 0) {
      this.protocol = protocols[0];
    }
    
    // Simulate connection process
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen.call(this as any, new Event('open'));
    }, 50);
  }

  // Helper method to simulate receiving a message
  mockReceiveMessage(data: any) {
    if (this.onmessage) {
      const messageData = typeof data === 'string' ? data : JSON.stringify(data);
      this.onmessage.call(this as any, new MessageEvent('message', { data: messageData }));
    }
  }

  // Helper method to trigger error
  mockError() {
    if (this.onerror) {
      this.onerror.call(this as any, new Event('error'));
    }
  }

  // Helper method to simulate connection close
  mockClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose.call(this as any, new CloseEvent('close', { code, reason }));
    }
  }
}

// Replace global WebSocket with our mock
global.WebSocket = MockWebSocket as any;

// Enhanced MediaStream mock
class MockMediaStream {
  private tracks: MediaStreamTrack[] = [];
  id: string = `mock-stream-${Math.random().toString(36).substr(2, 9)}`;
  active: boolean = true;

  constructor(tracks?: MediaStreamTrack[]) {
    if (tracks) {
      this.tracks = [...tracks];
    }
  }

  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
  }

  removeTrack(track: MediaStreamTrack) {
    const index = this.tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      this.tracks.splice(index, 1);
    }
  }

  getTracks() {
    return [...this.tracks];
  }

  getVideoTracks() {
    return this.tracks.filter(track => track.kind === 'video');
  }

  getAudioTracks() {
    return this.tracks.filter(track => track.kind === 'audio');
  }

  clone() {
    return new MockMediaStream(this.tracks);
  }
}

// MediaStreamTrack mock
class MockMediaStreamTrack {
  enabled: boolean = true;
  id: string = `mock-track-${Math.random().toString(36).substr(2, 9)}`;
  kind: string;
  label: string;
  muted: boolean = false;
  readyState: string = 'live';
  
  onended: ((this: MediaStreamTrack, ev: Event) => any) | null = null;
  onmute: ((this: MediaStreamTrack, ev: Event) => any) | null = null;
  onunmute: ((this: MediaStreamTrack, ev: Event) => any) | null = null;
  
  constructor(kind: 'audio' | 'video' = 'video') {
    this.kind = kind;
    this.label = `Mock ${kind.charAt(0).toUpperCase() + kind.slice(1)} Track`;
  }
  
  stop() {
    this.readyState = 'ended';
    if (this.onended) {
      // @ts-ignore - Ignoring type check for test mock
      this.onended.call(null, new Event('ended'));
    }
  }
  
  clone() {
    const track = new MockMediaStreamTrack(this.kind as 'audio' | 'video');
    track.enabled = this.enabled;
    track.muted = this.muted;
    return track;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    // Mock implementation
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    // Mock implementation
  }

  dispatchEvent(event: Event) {
    return true;
  }
}

// Mock getUserMedia
const mockGetUserMedia = jest.fn().mockImplementation(() => 
  Promise.resolve(
    new MockMediaStream([
      // @ts-ignore - Ignoring type check for test mock
      new MockMediaStreamTrack('video'),
      // @ts-ignore - Ignoring type check for test mock
      new MockMediaStreamTrack('audio')
    ])
  )
);

// Set up mock for navigator.mediaDevices
const mediaDevices = {
  getUserMedia: mockGetUserMedia,
  enumerateDevices: jest.fn().mockResolvedValue([
    {
      deviceId: 'mock-camera-id',
      kind: 'videoinput',
      label: 'Mock Camera',
      groupId: 'mock-camera-group'
    },
    {
      deviceId: 'mock-microphone-id',
      kind: 'audioinput',
      label: 'Mock Microphone',
      groupId: 'mock-microphone-group'
    }
  ]),
  getDisplayMedia: jest.fn().mockImplementation(() =>
    Promise.resolve(
      new MockMediaStream([
        // @ts-ignore - Ignoring type check for test mock
        new MockMediaStreamTrack('video')
      ])
    )
  )
};

// Mock HTMLMediaElement methods
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'MediaStream', {
    writable: true,
    value: MockMediaStream,
  });

  Object.defineProperty(window, 'MediaStreamTrack', {
    writable: true,
    value: MockMediaStreamTrack,
  });

  // Mock HTMLMediaElement methods
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    writable: true,
    value: jest.fn().mockImplementation(() => Promise.resolve()),
  });
  
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    writable: true,
    value: jest.fn(),
  });
  
  Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
    writable: true,
    value: null,
  });
}

// Apply navigator.mediaDevices mocks
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: mediaDevices,
});

// Mock Next.js functionalities
jest.mock('next/navigation', () => require('./mocks/nextNavigation'));
jest.mock('next/router', () => require('./mocks/nextRouter'));
jest.mock('next/link', () => require('./mocks/nextLink'));
jest.mock('next/image', () => require('./mocks/nextImage'));
jest.mock('next/headers', () => require('./mocks/nextHeaders'));

// Mock window.URL.createObjectURL
if (typeof window !== 'undefined') {
  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: jest.fn().mockImplementation((obj) => `mock-url-${Math.random().toString(36).substr(2, 9)}`),
  });
  
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: jest.fn(),
  });
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  private readonly _callback: IntersectionObserverCallback;
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this._callback = callback;
    if (options?.root) this.root = options.root;
    if (options?.rootMargin) this.rootMargin = options.rootMargin;
    if (options?.threshold) {
      this.thresholds = Array.isArray(options.threshold) 
        ? options.threshold 
        : [options.threshold];
    }
  }
  
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn().mockReturnValue([]);
  
  // Mock triggering the intersection
  mockIntersect(entries: IntersectionObserverEntry[]) {
    this._callback(entries, this);
  }
};

// Set up global fetch mock
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    headers: new Map(),
    status: 200,
    statusText: 'OK',
  })
);

// Set up some environment variables that Next.js might expect
process.env.NEXT_PUBLIC_WEBSOCKET_URL = 'ws://localhost:3001';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api'; 