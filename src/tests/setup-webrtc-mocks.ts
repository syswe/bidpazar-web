// WebRTC test setup
import { mockMediaDevices, mockDevices } from './mocks/mediasoup-client';
import { jest } from '@jest/globals';

/**
 * Sets up mock objects for WebRTC testing
 * Call this in your test setup to mock WebRTC-related browser APIs
 */
export function setupWebRTCMocks() {
  // Mock navigator.mediaDevices
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockMediaDevices.getUserMedia,
      enumerateDevices: mockMediaDevices.enumerateDevices,
      getSupportedConstraints: mockMediaDevices.getSupportedConstraints,
      
      // Mock other required properties
      ondevicechange: null,
      
      getDisplayMedia: jest.fn(async () => {
        const videoTrack = new MediaStreamTrack();
        videoTrack.kind = 'video';
        videoTrack.label = 'Mock Screen Share';
        return new MediaStream([videoTrack]);
      }),
      
      // Event listener methods
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(() => true),
    },
    writable: true,
  });
  
  // Helper to trigger device change events
  global.triggerDeviceChange = () => {
    const event = new Event('devicechange');
    navigator.mediaDevices.dispatchEvent(event);
  };
  
  // Define mock RTCPeerConnection implementation
  class MockRTCPeerConnection {
    localDescription: RTCSessionDescription | null = null;
    remoteDescription: RTCSessionDescription | null = null;
    connectionState: RTCPeerConnectionState = 'new';
    iceConnectionState: RTCIceConnectionState = 'new';
    iceGatheringState: RTCIceGatheringState = 'new';
    signalingState: RTCSignalingState = 'stable';
    
    // Event handlers
    onconnectionstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
    onicecandidate: ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => any) | null = null;
    oniceconnectionstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
    onicegatheringstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
    onsignalingstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;
    ontrack: ((this: RTCPeerConnection, ev: RTCTrackEvent) => any) | null = null;
    
    // Event listeners
    addEventListener = jest.fn();
    removeEventListener = jest.fn();
    dispatchEvent = jest.fn(() => true);
    
    // Methods with direct mock implementations instead of chaining
    createOffer = () => {
      return Promise.resolve({
        type: 'offer',
        sdp: 'mock-sdp'
      } as RTCSessionDescriptionInit);
    };
    
    createAnswer = () => {
      return Promise.resolve({
        type: 'answer',
        sdp: 'mock-sdp'
      } as RTCSessionDescriptionInit);
    };
    
    setLocalDescription = () => Promise.resolve();
    setRemoteDescription = () => Promise.resolve();
    addIceCandidate = () => Promise.resolve();
    
    addTransceiver = jest.fn();
    getTransceivers = () => [];
    getSenders = () => [];
    getReceivers = () => [];
    close = jest.fn();
    
    // Constructor can take a configuration object
    constructor(_configuration?: RTCConfiguration) {
      // Initialize any configuration-specific properties here if needed
    }
    
    // Static method required by the interface
    static generateCertificate(_keygenAlgorithm: AlgorithmIdentifier): Promise<RTCCertificate> {
      return Promise.resolve({
        expires: Date.now() + 86400000, // 24 hours from now
        getFingerprints: () => [{
          algorithm: 'sha-256',
          value: 'mock-fingerprint'
        }]
      } as RTCCertificate);
    }
  }
  
  // Replace global RTCPeerConnection with our mock
  global.RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection;
  
  console.log('[WebRTC Mocks] Setup complete');
}

// Export available mock devices for test reference
export { mockDevices };

// Create a MediaStreamTrack class for types
class MediaStreamTrack {
  enabled = true;
  id = `mock-track-${Date.now()}`;
  kind = 'video';
  label = 'Mock Track';
  muted = false;
  readyState = 'live';
  
  stop() {
    this.readyState = 'ended';
  }
  
  clone() {
    return new MediaStreamTrack();
  }
}

// Create a MediaStream class for types
class MediaStream {
  id = `mock-stream-${Date.now()}`;
  active = true;
  
  #tracks: MediaStreamTrack[] = [];
  
  constructor(tracks: MediaStreamTrack[] = []) {
    this.#tracks = [...tracks];
  }
  
  addTrack(track: MediaStreamTrack) {
    if (!this.#tracks.includes(track)) {
      this.#tracks.push(track);
    }
  }
  
  removeTrack(track: MediaStreamTrack) {
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