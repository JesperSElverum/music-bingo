/// <reference types="vite/client" />

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }

  interface SpotifyPlayerOptions {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  interface SpotifyTrack {
    uri: string;
    id: string | null;
    name: string;
    artists: { name: string; uri: string }[];
  }

  interface SpotifyPlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
      current_track: SpotifyTrack | null;
      previous_tracks: SpotifyTrack[];
      next_tracks: SpotifyTrack[];
    };
  }

  interface SpotifyPlayer {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: 'ready' | 'not_ready', cb: (s: { device_id: string }) => void): boolean;
    addListener(
      event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
      cb: (s: { message: string }) => void,
    ): boolean;
    addListener(event: 'player_state_changed', cb: (s: SpotifyPlaybackState | null) => void): boolean;
    removeListener(event: string): boolean;
    getCurrentState(): Promise<SpotifyPlaybackState | null>;
    togglePlay(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    nextTrack(): Promise<void>;
    previousTrack(): Promise<void>;
    setVolume(volume: number): Promise<void>;
  }
}

export {};
