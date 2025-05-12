declare module 'node-media-server' {
  interface NodeMediaServerConfig {
    rtmp?: {
      port: number;
      chunk_size?: number;
      gop_cache?: boolean;
      ping?: number;
      ping_timeout?: number;
    };
    http?: {
      port: number;
      allow_origin?: string;
      mediaroot?: string;
    };
    https?: {
      port: number;
      key: string;
      cert: string;
    };
    auth?: {
      play?: boolean;
      publish?: boolean;
      secret?: string;
      api?: boolean;
      api_user?: string;
      api_pass?: string;
    };
    trans?: {
      ffmpeg: string;
      tasks: Array<{
        app: string;
        hls?: boolean;
        hlsFlags?: string;
        hlsKeep?: boolean;
        dash?: boolean;
        dashFlags?: string;
        mp4?: boolean;
        mp4Flags?: string;
      }>;
    };
    relay?: {
      ffmpeg: string;
      tasks: Array<{
        app: string;
        mode: 'push' | 'pull' | 'static';
        edge?: string;
        name?: string;
        rtsp_transport?: 'udp' | 'tcp' | 'udp_multicast' | 'http';
      }>;
    };
    logType?: 0 | 1 | 2 | 3; // 0: no log, 1: error, 2: error+info, 3: debug
  }

  interface Session {
    reject: () => void;
    id: string;
    connectCreated: Date;
    streamPath?: string;
  }

  export default class NodeMediaServer {
    rtmpServer: any;
    httpServer: any;
    servers: Array<any>;
    
    constructor(config: NodeMediaServerConfig);
    
    // Core methods
    run(): void;
    
    // Note: The stop method appears in the type definition but is not reliably implemented
    // The actual implementation should handle cleanup of server components
    stop(): void;
    
    // Event handlers
    on(event: 'preConnect' | 'postConnect' | 'doneConnect', callback: (id: string, args: any) => void): void;
    on(event: 'prePublish' | 'postPublish' | 'donePublish', callback: (id: string, streamPath: string, args: any) => void): void;
    on(event: 'prePlay' | 'postPlay' | 'donePlay', callback: (id: string, streamPath: string, args: any) => void): void;
    
    // Session management
    getSession(id: string): Session | null;
    
    // Stream management
    getStreams(): Record<string, any>;
  }
} 