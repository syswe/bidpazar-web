// Enhanced mock for mediasoup-client
import { jest } from '@jest/globals';

// Create a proper MediaDeviceInfo class
class MockMediaDeviceInfo implements MediaDeviceInfo {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
  groupId: string;
  
  constructor(options: { deviceId: string; kind: MediaDeviceKind; label: string; groupId: string }) {
    this.deviceId = options.deviceId;
    this.kind = options.kind;
    this.label = options.label;
    this.groupId = options.groupId;
  }
  
  toJSON() {
    return {
      deviceId: this.deviceId,
      kind: this.kind,
      label: this.label,
      groupId: this.groupId
    };
  }
}

// Mock devices for testing using the proper class
const MOCK_DEVICES: MediaDeviceInfo[] = [
  new MockMediaDeviceInfo({ deviceId: 'default-video', kind: 'videoinput', label: 'Default Video Camera', groupId: 'group1' }),
  new MockMediaDeviceInfo({ deviceId: 'front-camera', kind: 'videoinput', label: 'Front Camera', groupId: 'group1' }),
  new MockMediaDeviceInfo({ deviceId: 'back-camera', kind: 'videoinput', label: 'Back Camera', groupId: 'group1' }),
  new MockMediaDeviceInfo({ deviceId: 'default-audio', kind: 'audioinput', label: 'Default Microphone', groupId: 'group2' }),
  new MockMediaDeviceInfo({ deviceId: 'headset-mic', kind: 'audioinput', label: 'Headset Microphone', groupId: 'group2' }),
  new MockMediaDeviceInfo({ deviceId: 'speakers', kind: 'audiooutput', label: 'Speakers', groupId: 'group3' }),
  new MockMediaDeviceInfo({ deviceId: 'headphones', kind: 'audiooutput', label: 'Headphones', groupId: 'group3' }),
];

class MockDevice {
  rtpCapabilities = {
    codecs: [
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        },
        rtcpFeedback: [
          { type: 'nack' },
          { type: 'nack', parameter: 'pli' },
          { type: 'ccm', parameter: 'fir' },
          { type: 'goog-remb' },
          { type: 'transport-cc' }
        ]
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1
        },
        rtcpFeedback: [
          { type: 'nack' },
          { type: 'nack', parameter: 'pli' },
          { type: 'ccm', parameter: 'fir' },
          { type: 'goog-remb' },
          { type: 'transport-cc' }
        ]
      },
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1
        },
        rtcpFeedback: [
          { type: 'transport-cc' }
        ]
      }
    ],
    headerExtensions: [
      {
        kind: 'audio',
        uri: 'urn:ietf:params:rtp-hdrext:sdes:mid',
        preferredId: 1
      },
      {
        kind: 'video',
        uri: 'urn:ietf:params:rtp-hdrext:sdes:mid',
        preferredId: 1
      },
      {
        kind: 'video',
        uri: 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id',
        preferredId: 2
      },
      {
        kind: 'video',
        uri: 'urn:3gpp:video-orientation',
        preferredId: 3
      },
      {
        kind: 'audio',
        uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
        preferredId: 5
      },
      {
        kind: 'video',
        uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
        preferredId: 5
      }
    ]
  };

  constructor() {
    console.log('[MockDevice] Created new MediaSoup device (mock)');
  }

  async load(options: { routerRtpCapabilities: any }) {
    console.log('[MockDevice] Loading device with router capabilities:', options.routerRtpCapabilities);
    return Promise.resolve();
  }

  canProduce(kind: string) {
    console.log(`[MockDevice] Checking if can produce ${kind}`);
    return true;
  }

  createSendTransport(options: any) {
    console.log('[MockDevice] Creating send transport with options:', options);
    return createMockTransport(options, 'send');
  }

  createRecvTransport(options: any) {
    console.log('[MockDevice] Creating receive transport with options:', options);
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

  // Helper to create appropriate mock tracks
  const createMockTrack = (kind: 'audio' | 'video'): MediaStreamTrack => {
    const track = new MediaStreamTrack();
    track.kind = kind;
    track.label = `Mock ${kind} Track`;
    track.id = `mock-${kind}-track-${Date.now()}`;
    console.log(`[MockTransport] Created mock ${kind} track: ${track.id}`);
    return track;
  };

  const transport = {
    id: options.id || `mock-${type}-transport-${Date.now()}`,
    closed: false,
    connectionState: 'new',
    appData: options.appData || {},
    
    // Event emitter
    on(event: string, callback: (...args: any[]) => void) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      console.log(`[MockTransport] Added listener for ${event} event`);
      return this;
    },

    // Transport methods
    async connect({ dtlsParameters }: { dtlsParameters: any }) {
      console.log(`[MockTransport] Connecting ${type} transport with DTLS parameters:`, dtlsParameters);
      this.connectionState = 'connecting';
      this._emitConnectionStateChange('connecting');
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.connectionState = 'connected';
      this._emitConnectionStateChange('connected');
      
      return Promise.resolve();
    },
    
    async produce(options: any) {
      console.log(`[MockTransport] Producing media of kind: ${options.track.kind}`);
      const producer = {
        id: `mock-producer-${Date.now()}`,
        kind: options.track.kind,
        track: options.track,
        paused: false,
        closed: false,
        appData: options.appData || {},
        pause: jest.fn(() => {
          console.log(`[MockProducer] Pausing ${options.track.kind} producer`);
          return Promise.resolve();
        }),
        resume: jest.fn(() => {
          console.log(`[MockProducer] Resuming ${options.track.kind} producer`);
          return Promise.resolve();
        }),
        close: jest.fn(() => {
          console.log(`[MockProducer] Closing ${options.track.kind} producer`);
          this.closed = true;
        }),
      };
      
      return producer;
    },
    
    async consume(options: any) {
      console.log(`[MockTransport] Consuming media with producer ID: ${options.producerId}`);
      
      // Create a mock track based on the consumer kind
      const kind = options.kind || 'video';
      const mockTrack = createMockTrack(kind as 'audio' | 'video');
      
      const consumer = {
        id: options.id || `mock-consumer-${Date.now()}`,
        producerId: options.producerId || 'mock-producer-id',
        kind: kind,
        track: mockTrack,
        rtpParameters: options.rtpParameters || {},
        paused: false,
        closed: false,
        appData: options.appData || {},
        pause: jest.fn(() => {
          console.log(`[MockConsumer] Pausing ${options.kind} consumer`);
          return Promise.resolve();
        }),
        resume: jest.fn(() => {
          console.log(`[MockConsumer] Resuming ${options.kind} consumer`);
          return Promise.resolve();
        }),
        close: jest.fn(() => {
          console.log(`[MockConsumer] Closing ${options.kind} consumer`);
          this.closed = true;
        }),
      };
      
      return consumer;
    },
    
    close() {
      console.log(`[MockTransport] Closing ${type} transport`);
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
      console.log(`[MockTransport] Connection state changed to: ${state}`);
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
  id = `mock-track-${Date.now()}`;
  kind = 'video';
  label = 'Mock Track';
  muted = false;
  readyState = 'live';
  contentHint = '';
  
  stop() {
    console.log(`[MockTrack] Stopping track: ${this.id}`);
    this.readyState = 'ended';
  }
  
  clone() {
    console.log(`[MockTrack] Cloning track: ${this.id}`);
    return new MediaStreamTrack();
  }
  
  applyConstraints() {
    return Promise.resolve();
  }
  
  getCapabilities() {
    return {
      width: { min: 640, max: 1920 },
      height: { min: 480, max: 1080 },
      aspectRatio: { min: 1.33, max: 1.78 },
      frameRate: { min: 15, max: 30 },
      facingMode: ['user', 'environment'],
      resizeMode: ['none', 'crop-and-scale']
    };
  }
  
  getConstraints() {
    return {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    };
  }
  
  getSettings() {
    return {
      width: 1280,
      height: 720,
      aspectRatio: 1.78,
      frameRate: 30,
      facingMode: 'user',
      deviceId: `mock-device-${this.id}`
    };
  }
}

// Add a MediaStream mock
class MediaStream {
  id = `mock-stream-${Date.now()}`;
  active = true;
  
  #tracks: MediaStreamTrack[] = [];
  
  constructor(tracks: MediaStreamTrack[] = []) {
    console.log(`[MockMediaStream] Created new stream with ${tracks.length} tracks`);
    this.#tracks = [...tracks];
  }
  
  addTrack(track: MediaStreamTrack) {
    console.log(`[MockMediaStream] Adding track: ${track.id} (${track.kind})`);
    if (!this.#tracks.includes(track)) {
      this.#tracks.push(track);
    }
  }
  
  removeTrack(track: MediaStreamTrack) {
    console.log(`[MockMediaStream] Removing track: ${track.id}`);
    this.#tracks = this.#tracks.filter(t => t !== track);
  }
  
  getTracks() {
    return [...this.#tracks];
  }
  
  getAudioTracks() {
    return this.#tracks.filter(t => t.kind === 'audio');
  }
  
  getVideoTracks() {
    return this.#tracks.filter(t => t.kind === 'video');
  }
  
  getTrackById(id: string) {
    return this.#tracks.find(t => t.id === id) || null;
  }
  
  clone() {
    return new MediaStream(this.#tracks.map(t => t.clone()));
  }
}

// Export mock objects
const mediasoupClient = {
  Device: MockDevice,
  types: {
    MediaStreamTrack,
    MediaStream,
    Transport: {} as any,
    Producer: {} as any,
    Consumer: {} as any,
    RtpCapabilities: {} as any,
  }
};

// Export helper objects for Jest setup
export const mockMediaDevices = {
  getUserMedia: jest.fn(async (constraints: MediaStreamConstraints) => {
    console.log('[MockNavigator] getUserMedia called with constraints:', constraints);
    
    const tracks: MediaStreamTrack[] = [];
    
    if (constraints.video) {
      const videoTrack = new MediaStreamTrack();
      videoTrack.kind = 'video';
      videoTrack.label = 'Mock Video Track';
      
      // If specific deviceId is requested, set the label accordingly
      if (typeof constraints.video === 'object' && constraints.video.deviceId && 
          typeof constraints.video.deviceId === 'object' && 'exact' in constraints.video.deviceId) {
        const deviceId = constraints.video.deviceId.exact;
        const device = MOCK_DEVICES.find(d => d.deviceId === deviceId && d.kind === 'videoinput');
        if (device) {
          videoTrack.label = device.label;
        }
      }
      
      tracks.push(videoTrack);
    }
    
    if (constraints.audio) {
      const audioTrack = new MediaStreamTrack();
      audioTrack.kind = 'audio';
      audioTrack.label = 'Mock Audio Track';
      
      // If specific deviceId is requested, set the label accordingly
      if (typeof constraints.audio === 'object' && constraints.audio.deviceId && 
          typeof constraints.audio.deviceId === 'object' && 'exact' in constraints.audio.deviceId) {
        const deviceId = constraints.audio.deviceId.exact;
        const device = MOCK_DEVICES.find(d => d.deviceId === deviceId && d.kind === 'audioinput');
        if (device) {
          audioTrack.label = device.label;
        }
      }
      
      tracks.push(audioTrack);
    }
    
    return new MediaStream(tracks);
  }),
  
  enumerateDevices: jest.fn(async () => {
    console.log('[MockNavigator] enumerateDevices called');
    return Promise.resolve([...MOCK_DEVICES]);
  }),
  
  getSupportedConstraints: jest.fn(() => ({
    width: true,
    height: true,
    aspectRatio: true,
    frameRate: true,
    facingMode: true,
    resizeMode: true,
    deviceId: true,
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true,
  })),
};

export const mockDevices = MOCK_DEVICES;

export default mediasoupClient; 