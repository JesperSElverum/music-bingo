export interface HostSession {
  roomCode: string;
  hostToken: string;
}

export interface PlayerSession {
  roomCode: string;
  playerToken: string;
  playerId: string;
  name: string;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

const K = {
  host: 'mb.host',
  player: 'mb.player',
  spotify: 'mb.spotify',
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

export const hostStore = {
  get: () => read<HostSession>(K.host),
  set: (s: HostSession) => write(K.host, s),
  clear: () => localStorage.removeItem(K.host),
};

export const playerStore = {
  get: () => read<PlayerSession>(K.player),
  set: (s: PlayerSession) => write(K.player, s),
  clear: () => localStorage.removeItem(K.player),
};

export const spotifyStore = {
  get: () => read<SpotifyTokens>(K.spotify),
  set: (s: SpotifyTokens) => write(K.spotify, s),
  clear: () => localStorage.removeItem(K.spotify),
};
