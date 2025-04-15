// Mock for mediasoup-client
class MockDevice {
  rtpCapabilities = {
    codecs: [{
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {},
      rtcpFeedback: []
    }, {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
      parameters: {},
      rtcpFeedback: []
    }],
    headerExtensions: []
  };

  constructor() {}

  async load() {
    return Promise.resolve();
  }

  canProduce() {
    return true;
  }

  createSendTransport(options: any) {
    return createMockTransport(options, 'send');
  }

  createRecvTransport(options: any) {
    return createMockTransport(options, 'recv');
  }
}

function createMockTransport(options: any, type: 'send' | 'recv') {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {
    connect: [],
    connectionstatechange: [],
    produce: [],
    producedata: [],
  };

  const transport = {
    id: options.id || 'mock-transport-id',
    closed: false,
    connectionState: 'new',
    appData: {},
    
    // Event emitter
    on(event: string, callback: (...args: any[]) => void) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      return this;
    },

    // Transport methods
    async connect() {
      return Promise.resolve();
    },
    
    async produce(options: any) {
      const producer = {
        id: 'mock-producer-id',
        kind: options.track.kind,
        track: options.track,
        paused: false,
        closed: false,
        appData: options.appData || {},
        pause: jest.fn(() => Promise.resolve()),
        resume: jest.fn(() => Promise.resolve()),
        close: jest.fn(),
      };
      
      return producer;
    },
    
    async consume(options: any) {
      const consumer = {
        id: options.id || 'mock-consumer-id',
        producerId: options.producerId || 'mock-producer-id',
        kind: options.kind || 'video',
        track: new MediaStreamTrack(),
        rtpParameters: options.rtpParameters || {},
        paused: false,
        closed: false,
        appData: options.appData || {},
        pause: jest.fn(() => Promise.resolve()),
        resume: jest.fn(() => Promise.resolve()),
        close: jest.fn(),
      };
      
      return consumer;
    },
    
    close() {
      this.closed = true;
      this.connectionState = 'closed';
      this._emitConnectionStateChange('closed');
    },
    
    // Private method to simulate events
    _emitEvent(event: string, ...args: any[]) {
      if (listeners[event]) {
        listeners[event].forEach(callback => callback(...args));
      }
    },
    
    _emitConnectionStateChange(state: string) {
      this.connectionState = state;
      this._emitEvent('connectionstatechange', state);
    },
    
    // Methods to trigger mock events (for testing)
    mockConnect() {
      const dtlsParameters = { role: 'auto', fingerprints: [{ algorithm: 'sha-256', value: 'mock-fingerprint' }] };
      const callback = jest.fn();
      const errback = jest.fn();
      
      listeners.connect.forEach(handler => {
        handler({ dtlsParameters }, callback, errback);
      });
      
      return { callback, errback };
    },
    
    mockProduce() {
      const produceParams = {
        kind: 'video',
        rtpParameters: { codecs: [], headerExtensions: [] },
        appData: {}
      };
      const callback = jest.fn();
      const errback = jest.fn();
      
      listeners.produce.forEach(handler => {
        handler(produceParams, callback, errback);
      });
      
      return { callback, errback };
    },
    
    mockChangeConnectionState(state: string) {
      this._emitConnectionStateChange(state);
    }
  };
  
  return transport;
}

// Create a MediaStreamTrack mock
class MediaStreamTrack {
  enabled = true;
  id = 'mock-track-id';
  kind = 'video';
  label = 'Mock Track';
  muted = false;
  readyState = 'live';
  
  stop() {}
  
  clone() {
    return new MediaStreamTrack();
  }
}

// Export mock objects
const mediasoupClient = {
  Device: MockDevice,
  types: {
    MediaStreamTrack,
    Transport: {} as any,
    Producer: {} as any,
    Consumer: {} as any,
    RtpCapabilities: {} as any,
  }
};

export default mediasoupClient; 