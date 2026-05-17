import { generateRoomCode, generateToken, generatePlayerId } from './ids.js';
import { generateBoard, makeInitialMarks, NON_FREE_NEEDED } from './bingo.js';

const ROOM_IDLE_MS = 10 * 60 * 1000;
const GC_INTERVAL_MS = 60 * 1000;

const rooms = new Map();

export function createRoom({ tracks, spotifyPlaylistId, playlistName }) {
  if (!Array.isArray(tracks) || tracks.length < NON_FREE_NEEDED) {
    const err = new Error(`Playlist needs at least ${NON_FREE_NEEDED} tracks`);
    err.code = 'PLAYLIST_TOO_SMALL';
    throw err;
  }
  const code = generateRoomCode(rooms);
  const room = {
    code,
    hostToken: generateToken(),
    hostSocketId: null,
    spotifyPlaylistId,
    playlistName,
    tracks,
    trackById: new Map(tracks.map((t) => [t.id, t])),
    playedTrackIds: new Set(),
    currentTrackId: null,
    status: 'lobby',
    currentGoal: 1,
    players: new Map(),
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function deleteRoom(code) {
  rooms.delete(code);
}

export function touch(room) {
  room.lastActivityAt = Date.now();
}

export function addPlayer(room, name) {
  const id = generatePlayerId();
  const player = {
    id,
    name: (name || 'Player').slice(0, 24),
    playerToken: generateToken(),
    socketId: null,
    board: null,
    marks: null,
    bingos: 0,
    connected: true,
  };
  room.players.set(id, player);
  touch(room);
  return player;
}

export function findPlayerByToken(room, token) {
  for (const p of room.players.values()) if (p.playerToken === token) return p;
  return null;
}

export function dealBoards(room) {
  const trackIds = room.tracks.map((t) => t.id);
  for (const p of room.players.values()) {
    p.board = generateBoard(trackIds);
    p.marks = makeInitialMarks();
    p.bingos = 0;
  }
}

export function trackPayload(room, trackId) {
  const t = room.trackById.get(trackId);
  if (!t) return { id: trackId, name: 'Unknown', artists: [] };
  return { id: t.id, uri: t.uri, name: t.name, artists: t.artists };
}

export function playerPublic(p) {
  return { id: p.id, name: p.name, bingos: p.bingos, connected: p.connected };
}

export function roomSnapshot(room) {
  return {
    code: room.code,
    status: room.status,
    currentGoal: room.currentGoal,
    currentTrackId: room.currentTrackId,
    playedTrackIds: Array.from(room.playedTrackIds),
    players: Array.from(room.players.values()).map(playerPublic),
    playlistName: room.playlistName,
    trackCount: room.tracks.length,
  };
}

export function playerSnapshot(p) {
  return {
    id: p.id,
    name: p.name,
    board: p.board,
    marks: p.marks,
    bingos: p.bingos,
  };
}

export function startGc() {
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      const anyConnected =
        (room.hostSocketId != null) ||
        Array.from(room.players.values()).some((p) => p.connected);
      if (!anyConnected && now - room.lastActivityAt > ROOM_IDLE_MS) {
        rooms.delete(code);
      }
    }
  }, GC_INTERVAL_MS).unref?.();
}

export function listRoomsForDebug() {
  return Array.from(rooms.keys());
}
