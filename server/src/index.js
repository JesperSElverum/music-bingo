import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from repo root regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // also try cwd as a fallback

import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';

import {
  buildAuthorizeUrl, newState, exchangeCode, refreshToken,
  fetchMyPlaylists, fetchPlaylistTracks, whoAmI,
} from './spotify.js';
import { registerSocketHandlers } from './socket.js';
import { startGc } from './rooms.js';

const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(express.json());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: false }));

app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function clientUrl(pathAndQuery) {
  const base = isProd ? '' : CLIENT_ORIGIN;
  return `${base}${pathAndQuery}`;
}

app.get('/api/spotify/login', (_req, res) => {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET || !process.env.SPOTIFY_REDIRECT_URI) {
    return res.status(500).send('Spotify env vars are not configured on the server.');
  }
  const state = newState();
  stateStore.set(state, Date.now());
  res.redirect(buildAuthorizeUrl(state));
});

app.get('/api/spotify/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(clientUrl(`/create?error=${encodeURIComponent(String(error))}`));
    if (!code || !state || !stateStore.has(String(state))) {
      return res.redirect(clientUrl('/create?error=invalid_state'));
    }
    stateStore.delete(String(state));
    // GC old states
    const now = Date.now();
    for (const [k, t] of stateStore) if (now - t > STATE_TTL_MS) stateStore.delete(k);

    const tokens = await exchangeCode(String(code));
    const params = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: String(tokens.expires_in),
    });
    res.redirect(clientUrl(`/create?${params}`));
  } catch (e) {
    console.error('callback error', e);
    res.redirect(clientUrl(`/create?error=${encodeURIComponent('token_exchange_failed')}`));
  }
});

app.post('/api/spotify/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) return res.status(400).json({ error: 'missing_refresh_token' });
    const tokens = await refreshToken(refresh_token);
    res.json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token ?? refresh_token,
    });
  } catch (e) {
    console.error('refresh error', e);
    res.status(500).json({ error: 'refresh_failed' });
  }
});

app.get('/api/spotify/me', async (req, res) => {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) return res.status(401).json({ error: 'missing_token' });
    const me = await whoAmI(token);
    res.json(me);
  } catch (e) {
    console.error('me error', e);
    res.status(e.status || 500).json({ error: 'me_failed', detail: e.message });
  }
});

app.get('/api/spotify/playlists', async (req, res) => {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) return res.status(401).json({ error: 'missing_token' });
    const playlists = await fetchMyPlaylists(token);
    res.json({ playlists });
  } catch (e) {
    console.error('playlists error', e);
    res.status(e.status || 500).json({ error: 'playlists_failed' });
  }
});

app.get('/api/spotify/playlist/:id/tracks', async (req, res) => {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!token) return res.status(401).json({ error: 'missing_token' });
    const tracks = await fetchPlaylistTracks(req.params.id, token);
    res.json({ tracks });
  } catch (e) {
    console.error('tracks error', e);
    res.status(e.status || 500).json({ error: 'tracks_failed' });
  }
});

if (isProd) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: CLIENT_ORIGIN },
});
registerSocketHandlers(io);
startGc();

server.listen(PORT, () => {
  console.log(`Music bingo server listening on :${PORT} (${isProd ? 'prod' : 'dev'})`);
});
