import { spotifyStore, SpotifyTokens } from './storage';

export interface SpotifyPlaylist {
  id: string;
  name: string;
  owner: string | null;
  image: string | null;
  trackCount: number;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string[];
}

async function ensureFreshToken(): Promise<string> {
  const tokens = spotifyStore.get();
  if (!tokens) throw new Error('Not connected to Spotify');
  if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken;
  const res = await fetch('/api/spotify/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  });
  if (!res.ok) throw new Error('Failed to refresh Spotify token');
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
  };
  const next: SpotifyTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  spotifyStore.set(next);
  return next.accessToken;
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await ensureFreshToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function getPlaylists(): Promise<SpotifyPlaylist[]> {
  const res = await authedFetch('/api/spotify/playlists');
  if (!res.ok) throw new Error('Failed to fetch playlists');
  const j = (await res.json()) as { playlists: SpotifyPlaylist[] };
  return j.playlists;
}

export async function getPlaylistTracks(id: string): Promise<SpotifyTrack[]> {
  const res = await authedFetch(`/api/spotify/playlist/${id}/tracks`);
  if (!res.ok) throw new Error('Failed to fetch tracks');
  const j = (await res.json()) as { tracks: SpotifyTrack[] };
  return j.tracks;
}

export async function getCurrentAccessToken(): Promise<string> {
  return ensureFreshToken();
}
