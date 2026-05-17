import { randomBytes } from 'node:crypto';

const SCOPES = [
  'streaming',                  // Web Playback SDK can play music in the browser
  'user-modify-playback-state', // transfer playback + start playing a list of URIs
  'playlist-read-private',      // list the host's private playlists
  'playlist-read-collaborative',// list collaborative playlists too
].join(' ');

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: env('SPOTIFY_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: env('SPOTIFY_REDIRECT_URI'),
    scope: SCOPES,
    state,
    show_dialog: 'false',
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export function newState() {
  return randomBytes(16).toString('base64url');
}

async function tokenRequest(form) {
  const basic = Buffer.from(
    `${env('SPOTIFY_CLIENT_ID')}:${env('SPOTIFY_CLIENT_SECRET')}`,
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token request failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function exchangeCode(code) {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env('SPOTIFY_REDIRECT_URI'),
  });
}

export async function refreshToken(refresh_token) {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token,
  });
}

async function spotifyGet(path, accessToken) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Spotify ${path} failed: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchMyPlaylists(accessToken) {
  const out = [];
  let url = '/me/playlists?limit=50';
  while (url) {
    const page = await spotifyGet(url, accessToken);
    for (const item of page.items) {
      if (!item) continue;
      out.push({
        id: item.id,
        name: item.name,
        owner: item.owner?.display_name ?? null,
        image: item.images?.[0]?.url ?? null,
        trackCount: item.tracks?.total ?? 0,
      });
    }
    if (page.next) {
      url = page.next.replace('https://api.spotify.com/v1', '');
    } else {
      url = null;
    }
  }
  return out;
}

export async function fetchPlaylistTracks(playlistId, accessToken) {
  const out = [];
  let url = `/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,uri,name,artists(name),is_local,type))`;
  while (url) {
    const page = await spotifyGet(url, accessToken);
    for (const it of page.items) {
      const t = it?.track;
      if (!t?.id || t.is_local || t.type !== 'track' || !t.uri) continue;
      out.push({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artists: (t.artists || []).map((a) => a.name),
      });
    }
    if (page.next) {
      url = page.next.replace('https://api.spotify.com/v1', '');
    } else {
      url = null;
    }
  }
  return out;
}
