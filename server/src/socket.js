import {
  createRoom, getRoom, touch, addPlayer, findPlayerByToken,
  dealBoards, trackPayload, playerPublic, roomSnapshot, playerSnapshot,
} from './rooms.js';
import {
  findValidBingoLines, isFullBoardValid, goalThreshold, nextGoal, FREE_CELL,
} from './bingo.js';

function emitRoom(io, room, event, payload) {
  io.to(room.code).emit(event, payload);
}

function emitToHost(io, room, event, payload) {
  if (room.hostSocketId) io.to(room.hostSocketId).emit(event, payload);
}

function ack(cb, payload) {
  if (typeof cb === 'function') cb(payload);
}

function bindRoomToSocket(socket, room) {
  socket.data.roomCode = room.code;
  socket.join(room.code);
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('host:create', async ({ tracks, spotifyPlaylistId, playlistName }, cb) => {
      try {
        if (!Array.isArray(tracks)) throw new Error('tracks must be an array');
        const room = createRoom({ tracks, spotifyPlaylistId, playlistName });
        room.hostSocketId = socket.id;
        socket.data.isHost = true;
        bindRoomToSocket(socket, room);
        ack(cb, { ok: true, roomCode: room.code, hostToken: room.hostToken, snapshot: roomSnapshot(room) });
      } catch (e) {
        ack(cb, { ok: false, error: e.message, code: e.code });
      }
    });

    socket.on('host:resume', ({ roomCode, hostToken }, cb) => {
      const room = getRoom(roomCode);
      if (!room || room.hostToken !== hostToken) {
        return ack(cb, { ok: false, error: 'Room not found' });
      }
      room.hostSocketId = socket.id;
      socket.data.isHost = true;
      bindRoomToSocket(socket, room);
      touch(room);
      ack(cb, { ok: true, snapshot: roomSnapshot(room) });
      emitRoom(io, room, 'room:host-connected', {});
    });

    socket.on('host:start', ({ roomCode }, cb) => {
      const room = getRoom(roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack(cb, { ok: false, error: 'Not host' });
      if (room.players.size < 1) return ack(cb, { ok: false, error: 'Need at least 1 player' });
      dealBoards(room);
      room.status = 'playing';
      room.currentGoal = 1;
      room.playedTrackIds = new Set();
      room.currentTrackId = null;
      touch(room);
      ack(cb, { ok: true });
      emitRoom(io, room, 'room:started', { snapshot: roomSnapshot(room) });
      for (const p of room.players.values()) {
        if (p.socketId) io.to(p.socketId).emit('player:board', playerSnapshot(p));
      }
    });

    socket.on('host:get-track-uris', ({ roomCode }, cb) => {
      const room = getRoom(roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack(cb, { ok: false });
      // shuffle uri list for the host to feed into Spotify
      const uris = room.tracks.map((t) => t.uri);
      for (let i = uris.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uris[i], uris[j]] = [uris[j], uris[i]];
      }
      ack(cb, { ok: true, uris });
    });

    socket.on('host:track-meta', ({ roomCode, trackIds }, cb) => {
      const room = getRoom(roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack(cb, { ok: false });
      const out = (trackIds || []).map((id) => trackPayload(room, id));
      ack(cb, { ok: true, tracks: out });
    });

    socket.on('player:track-meta', ({ roomCode, trackIds }, cb) => {
      const room = getRoom(roomCode);
      if (!room) return ack(cb, { ok: false });
      const playerId = socket.data.playerId;
      if (!playerId || !room.players.has(playerId)) return ack(cb, { ok: false });
      const out = (trackIds || []).map((id) => trackPayload(room, id));
      ack(cb, { ok: true, tracks: out });
    });

    socket.on('host:track-changed', ({ roomCode, trackId }) => {
      const room = getRoom(roomCode);
      if (!room || room.hostSocketId !== socket.id) return;
      if (!trackId) return;
      room.playedTrackIds.add(trackId);
      room.currentTrackId = trackId;
      touch(room);
      emitRoom(io, room, 'room:track-changed', {
        track: trackPayload(room, trackId),
        playedTrackIds: Array.from(room.playedTrackIds),
      });
    });

    socket.on('host:validate-claim', ({ roomCode, playerId, accept }, cb) => {
      const room = getRoom(roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack(cb, { ok: false });
      const player = room.players.get(playerId);
      if (!player) return ack(cb, { ok: false, error: 'Unknown player' });
      if (accept) {
        player.bingos += 1;
        const advanced = maybeAdvanceGoal(room);
        emitRoom(io, room, 'room:bingo-confirmed', {
          playerId: player.id,
          name: player.name,
          totalBingos: player.bingos,
        });
        emitRoom(io, room, 'room:players', {
          players: Array.from(room.players.values()).map(playerPublic),
        });
        if (advanced) {
          if (room.currentGoal === 'full' && advanced === 'ended') {
            // handled in maybeAdvanceGoal
          } else {
            emitRoom(io, room, 'room:goal-changed', { currentGoal: room.currentGoal });
          }
        }
      } else {
        emitRoom(io, room, 'room:claim-rejected', { playerId });
      }
      touch(room);
      ack(cb, { ok: true });
    });

    socket.on('host:advance-goal', ({ roomCode }, cb) => {
      const room = getRoom(roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack(cb, { ok: false });
      room.currentGoal = nextGoal(room.currentGoal);
      touch(room);
      emitRoom(io, room, 'room:goal-changed', { currentGoal: room.currentGoal });
      ack(cb, { ok: true });
    });

    socket.on('host:end-game', ({ roomCode }, cb) => {
      const room = getRoom(roomCode);
      if (!room || room.hostSocketId !== socket.id) return ack(cb, { ok: false });
      endGame(io, room);
      ack(cb, { ok: true });
    });

    socket.on('player:join', ({ roomCode, name }, cb) => {
      const room = getRoom(roomCode);
      if (!room) return ack(cb, { ok: false, error: 'Room not found' });
      if (room.status !== 'lobby') return ack(cb, { ok: false, error: 'Game already started' });
      const player = addPlayer(room, name);
      player.socketId = socket.id;
      socket.data.playerId = player.id;
      bindRoomToSocket(socket, room);
      ack(cb, {
        ok: true,
        playerId: player.id,
        playerToken: player.playerToken,
        snapshot: roomSnapshot(room),
      });
      emitRoom(io, room, 'room:player-joined', { player: playerPublic(player) });
    });

    socket.on('player:resume', ({ roomCode, playerToken }, cb) => {
      const room = getRoom(roomCode);
      if (!room) return ack(cb, { ok: false, error: 'Room not found' });
      const player = findPlayerByToken(room, playerToken);
      if (!player) return ack(cb, { ok: false, error: 'Player not found' });
      player.socketId = socket.id;
      player.connected = true;
      socket.data.playerId = player.id;
      bindRoomToSocket(socket, room);
      touch(room);
      ack(cb, {
        ok: true,
        playerId: player.id,
        snapshot: roomSnapshot(room),
        board: player.board ? playerSnapshot(player) : null,
      });
      emitRoom(io, room, 'room:players', {
        players: Array.from(room.players.values()).map(playerPublic),
      });
    });

    socket.on('player:mark-square', ({ roomCode, index, state }) => {
      const room = getRoom(roomCode);
      if (!room) return;
      const playerId = socket.data.playerId;
      const player = room.players.get(playerId);
      if (!player?.marks) return;
      if (typeof index !== 'number' || index < 0 || index >= player.marks.length) return;
      if (player.board[index] === FREE_CELL) return;
      if (!['empty', 'possible', 'marked'].includes(state)) return;
      player.marks[index] = state;
      touch(room);
    });

    socket.on('player:claim-bingo', ({ roomCode }, cb) => {
      const room = getRoom(roomCode);
      if (!room) return ack(cb, { ok: false });
      const playerId = socket.data.playerId;
      const player = room.players.get(playerId);
      if (!player?.board) return ack(cb, { ok: false });

      const validLines = findValidBingoLines(player, room.playedTrackIds);
      const threshold = goalThreshold(room.currentGoal);
      let isValid;
      if (room.currentGoal === 'full') {
        isValid = isFullBoardValid(player, room.playedTrackIds);
      } else {
        isValid = validLines.length >= threshold;
      }

      emitToHost(io, room, 'room:claim', {
        playerId: player.id,
        name: player.name,
        validLines,
        board: player.board,
        marks: player.marks,
        isValid,
        currentGoal: room.currentGoal,
      });
      ack(cb, { ok: true, isValid });
    });

    socket.on('disconnect', () => {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;
      if (socket.data.isHost && room.hostSocketId === socket.id) {
        room.hostSocketId = null;
        emitRoom(io, room, 'room:host-disconnected', {});
      } else if (socket.data.playerId) {
        const p = room.players.get(socket.data.playerId);
        if (p && p.socketId === socket.id) {
          p.connected = false;
          emitRoom(io, room, 'room:players', {
            players: Array.from(room.players.values()).map(playerPublic),
          });
        }
      }
      touch(room);
    });
  });
}

function maybeAdvanceGoal(room) {
  const threshold = goalThreshold(room.currentGoal);
  if (room.currentGoal === 'full') {
    const anyFullWin = Array.from(room.players.values()).some(
      (p) => p.board && isFullBoardValid(p, room.playedTrackIds),
    );
    if (anyFullWin) {
      endGameInline(room);
      return 'ended';
    }
    return null;
  }
  const someoneMet = Array.from(room.players.values()).some((p) => p.bingos >= threshold);
  if (someoneMet) {
    room.currentGoal = nextGoal(room.currentGoal);
    return true;
  }
  return null;
}

function endGameInline(room) {
  room.status = 'ended';
}

function endGame(io, room) {
  room.status = 'ended';
  io.to(room.code).emit('room:ended', {
    winners: Array.from(room.players.values())
      .map(playerPublic)
      .sort((a, b) => b.bingos - a.bingos),
  });
}
