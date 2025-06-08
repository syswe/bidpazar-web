import { logger } from "@/lib/logger";

// Global state tracking
const globalState = new Map<string, MediaState>();

// Constants
const INITIALIZATION_COOLDOWN = 1000; // 1 second
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

export interface MediaState {
  isCameraOn: boolean;
  isMicrophoneOn: boolean;
  isInitialized: boolean;
  error: string | null;
  lastInitializationAttempt: number;
  retryCount: number;
}

type StateUpdateCallback = (state: MediaState) => void;

export class MediaStateManager {
  private state: MediaState;
  private onStateUpdate: StateUpdateCallback;
  private instanceId: string;
  private isDestroyed: boolean = false;

  constructor(
    instanceId: string,
    initialState: MediaState,
    onStateUpdate: StateUpdateCallback
  ) {
    this.instanceId = instanceId;
    this.state = { ...initialState };
    this.onStateUpdate = onStateUpdate;
  }

  private updateState(newState: Partial<MediaState>) {
    if (this.isDestroyed) return;

    this.state = {
      ...this.state,
      ...newState
    };

    this.onStateUpdate(this.state);
  }

  setCameraEnabled(enabled: boolean) {
    this.updateState({ isCameraOn: enabled });
  }

  setMicrophoneEnabled(enabled: boolean) {
    this.updateState({ isMicrophoneOn: enabled });
  }

  setInitialized(initialized: boolean) {
    this.updateState({ isInitialized: initialized });
  }

  setError(error: string | null) {
    this.updateState({ error });
  }

  incrementRetryCount() {
    this.updateState({ retryCount: this.state.retryCount + 1 });
  }

  updateLastInitializationAttempt() {
    this.updateState({ lastInitializationAttempt: Date.now() });
  }

  getState(): MediaState {
    return { ...this.state };
  }

  cleanup() {
    this.isDestroyed = true;
  }
} 