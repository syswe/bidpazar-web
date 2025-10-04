declare module "@livekit/components-react" {
  import * as React from "react";

  export const LiveKitRoom: React.ComponentType<any>;
  export const VideoConference: React.ComponentType<any>;
  export const GridLayout: React.ComponentType<any>;
  export const ParticipantTile: React.ComponentType<any>;
  export const ControlBar: React.ComponentType<any>;
  export const RoomAudioRenderer: React.ComponentType<any>;
  export const MediaDeviceMenu: React.ComponentType<any>;
  export const DisconnectButton: React.ComponentType<any>;
  export function useLocalParticipant(): any;
  export function useRoomContext(): any;
  export function useTracks(sources?: any, options?: any): any;
}
