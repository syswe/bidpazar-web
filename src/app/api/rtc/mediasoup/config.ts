// MediaSoup configuration settings with enhanced logging and diagnostics
import { logger } from '@/lib/logger';

// Log load of configuration file
logger.debug('[MediaSoup:Config] Loading MediaSoup configuration');

// Environment variable diagnostics
const ENV_DIAGNOSTICS = {
  MEDIASOUP_ANNOUNCED_IP: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
  MEDIASOUP_MIN_PORT: process.env.MEDIASOUP_MIN_PORT || '40000',
  MEDIASOUP_MAX_PORT: process.env.MEDIASOUP_MAX_PORT || '40100',
  MEDIASOUP_WORKERS: process.env.MEDIASOUP_WORKERS || '1',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Log environment values
logger.info('[MediaSoup:Config] Environment configuration loaded', ENV_DIAGNOSTICS);

// Configuration statistics collector
const configStats = {
  timestamp: new Date().toISOString(),
  environment: ENV_DIAGNOSTICS,
  codecs: {
    audio: 0,
    video: 0
  }
};

// Helper to validate network configuration
const validateNetworkConfig = () => {
  const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP;
  
  // Check if IP looks valid
  const isValidIp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(announcedIp || '');
  
  if (!isValidIp && announcedIp !== 'localhost' && announcedIp !== undefined) {
    logger.warn('[MediaSoup:Config] Potentially invalid MEDIASOUP_ANNOUNCED_IP', { 
      value: announcedIp,
      recommendation: 'Should be a valid IPv4 address like 192.168.1.1'
    });
  }
  
  // Check port range
  const minPort = parseInt(process.env.MEDIASOUP_MIN_PORT || '40000');
  const maxPort = parseInt(process.env.MEDIASOUP_MAX_PORT || '40100');
  
  if (minPort >= maxPort) {
    logger.error('[MediaSoup:Config] Invalid port range configuration', {
      minPort,
      maxPort,
      recommendation: 'MEDIASOUP_MIN_PORT should be less than MEDIASOUP_MAX_PORT'
    });
  }
  
  if (maxPort - minPort < 100) {
    logger.warn('[MediaSoup:Config] Small port range may limit scalability', {
      minPort,
      maxPort,
      portsAvailable: maxPort - minPort + 1,
      recommendation: 'Consider a larger port range for production environments'
    });
  }
  
  return {
    isValidIp,
    minPort,
    maxPort,
    portRange: maxPort - minPort + 1
  };
};

// Run network validation
const networkValidation = validateNetworkConfig();
logger.debug('[MediaSoup:Config] Network configuration validation', networkValidation);

// Define standard configuration with detailed comments
export const mediasoupConfig = {
  // Router options
  routerOptions: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        // Advanced OPUS parameters for better quality
        parameters: {
          useinbandfec: 1, // Enable in-band FEC
          minptime: 10,    // Minimum packet time
          maxptime: 60,    // Maximum packet time
          stereo: 1        // Enable stereo
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
          'x-google-min-bitrate': 500,
          'x-google-max-bitrate': 3000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2, // Profile 2 for 4:2:0 color with 10-bit depth
          'x-google-start-bitrate': 1000,
          'x-google-min-bitrate': 500,
          'x-google-max-bitrate': 3000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,      // Single NAL unit mode
          'profile-level-id': '4d0032', // Baseline profile, level 5
          'level-asymmetry-allowed': 1, // Allow level asymmetry
          'x-google-start-bitrate': 1000,
          'x-google-min-bitrate': 500,
          'x-google-max-bitrate': 3000
        }
      }
    ]
  },
  
  // WebRTC transport options
  webRtcTransportOptions: {
    // Use env var MEDIASOUP_ANNOUNCED_IP if set, otherwise default to 127.0.0.1
    listenIps: [
      {
        ip: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
        announcedIp: null // Will be set to the same as ip by mediasoup if null
      }
    ],
    // Enable both UDP and TCP for maximum compatibility
    enableUdp: true,
    enableTcp: true,
    preferUdp: true, // Prefer UDP for better performance when possible
    // Initial outgoing bitrate capacity
    initialAvailableOutgoingBitrate: 1000000, // 1 Mbps
    minimumAvailableOutgoingBitrate: 600000,  // 600 kbps
    // SCTP related parameters for data channels
    maxSctpMessageSize: 262144, // 256 KiB
    // Max incoming bitrate
    maxIncomingBitrate: 1500000  // 1.5 Mbps
  },
  
  // Worker options
  workerSettings: {
    logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
      'rtx',
      'bwe',
      'score',
      'simulcast',
      'svc',
      'sctp'
    ],
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '40100'),
    // Advanced worker settings
    dtlsCertificateFile: process.env.MEDIASOUP_DTLS_CERT_FILE,
    dtlsPrivateKeyFile: process.env.MEDIASOUP_DTLS_KEY_FILE
  },
  
  // Number of mediasoup workers to create
  numWorkers: parseInt(process.env.MEDIASOUP_WORKERS || '1')
};

// Update stats for logging
configStats.codecs.audio = mediasoupConfig.routerOptions.mediaCodecs.filter(codec => codec.kind === 'audio').length;
configStats.codecs.video = mediasoupConfig.routerOptions.mediaCodecs.filter(codec => codec.kind === 'video').length;

// Log completion
logger.info('[MediaSoup:Config] MediaSoup configuration loaded successfully', { 
  workers: mediasoupConfig.numWorkers,
  portRange: {
    min: mediasoupConfig.workerSettings.rtcMinPort,
    max: mediasoupConfig.workerSettings.rtcMaxPort,
    total: mediasoupConfig.workerSettings.rtcMaxPort - mediasoupConfig.workerSettings.rtcMinPort + 1
  },
  codecs: {
    audio: configStats.codecs.audio,
    video: configStats.codecs.video,
    formats: mediasoupConfig.routerOptions.mediaCodecs.map(codec => codec.mimeType)
  },
  listenIps: mediasoupConfig.webRtcTransportOptions.listenIps
});

// Export stats helper for diagnostics
export const getMediasoupConfigStats = () => {
  return {
    ...configStats,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}; 