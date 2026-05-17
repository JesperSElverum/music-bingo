import { getCurrentAccessToken } from './api';

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.Spotify?.Player) return resolve();
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const tag = document.createElement('script');
    tag.src = SDK_SRC;
    tag.async = true;
    tag.onerror = () => reject(new Error('Failed to load Spotify SDK'));
    document.body.appendChild(tag);
  });
  return sdkPromise;
}

export interface PlayerHandle {
  player: SpotifyPlayer;
  deviceId: string;
}

export type FatalReason = 'init' | 'auth' | 'account';

export interface SetupOptions {
  onTrackChange: (track: { id: string; name: string; artists: string[]; uri: string }) => void;
  onStateChange?: (state: SpotifyPlaybackState | null) => void;
  onFatal?: (reason: FatalReason, message: string) => void;
}

export async function setupPlayer(opts: SetupOptions): Promise<PlayerHandle> {
  await loadSdk();
  const player = new window.Spotify!.Player({
    name: 'Music Bingo (host)',
    getOAuthToken: async (cb) => {
      try {
        const t = await getCurrentAccessToken();
        cb(t);
      } catch (e) {
        console.error(e);
      }
    },
    volume: 0.7,
  });

  player.addListener('initialization_error', ({ message }) => opts.onFatal?.('init', message));
  player.addListener('authentication_error', ({ message }) => opts.onFatal?.('auth', message));
  player.addListener('account_error', ({ message }) => opts.onFatal?.('account', message));
  player.addListener('playback_error', ({ message }) => console.warn('playback_error', message));

  let lastTrackId: string | null = null;
  player.addListener('player_state_changed', (state) => {
    opts.onStateChange?.(state);
    const cur = state?.track_window?.current_track ?? null;
    if (cur && cur.id && cur.id !== lastTrackId) {
      lastTrackId = cur.id;
      opts.onTrackChange({
        id: cur.id,
        uri: cur.uri,
        name: cur.name,
        artists: cur.artists.map((a) => a.name),
      });
    }
  });

  const deviceId = await new Promise<string>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Spotify player did not become ready')), 15_000);
    player.addListener('ready', ({ device_id }) => {
      clearTimeout(t);
      resolve(device_id);
    });
    player.connect().catch(reject);
  });

  return { player, deviceId };
}

async function spotifyApi(method: string, path: string, body?: unknown) {
  const token = await getCurrentAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    const txt = await res.text();
    throw new Error(`Spotify API ${method} ${path} failed: ${res.status} ${txt}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export async function transferPlaybackTo(deviceId: string) {
  await spotifyApi('PUT', '/me/player', { device_ids: [deviceId], play: false });
}

export async function startPlayback(deviceId: string, uris: string[]) {
  await spotifyApi('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { uris });
}

export async function togglePlay(player: SpotifyPlayer) {
  await player.togglePlay();
}

export async function nextTrack(player: SpotifyPlayer) {
  await player.nextTrack();
}

export async function previousTrack(player: SpotifyPlayer) {
  await player.previousTrack();
}
