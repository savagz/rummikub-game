import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDeck, dealTiles, isValidMeld, calculateScore, generateRoomCode } from './src/game/rummikubEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(distDir));

const rooms = new Map(); // roomCode → roomState

function buildPublicState(room, forSocketId) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    board: room.board,
    deckCount: room.deck.length,
    difficulty: room.difficulty ?? 'easy',
    turnStartedAt: room.turnStartedAt ?? null,
    currentPlayerId: room.players[room.currentPlayerIndex]?.id ?? null,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      handCount: p.hand.length,
      hasInitialMeld: p.hasInitialMeld,
      score: p.score,
    })),
    yourHand: room.players.find(p => p.id === forSocketId)?.hand ?? [],
    winner: room.winner ?? null,
  };
}

function emitRoomUpdate(room) {
  for (const player of room.players) {
    io.to(player.id).emit('room-updated', buildPublicState(room, player.id));
  }
}

function nextPlayer(room) {
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  room.turnStartedAt = Date.now();
}

function checkWin(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (player && player.hand.length === 0) {
    room.status = 'ended';
    room.winner = playerId;
    for (const p of room.players) {
      p.score = calculateScore(p.hand);
    }
    return true;
  }
  return false;
}

io.on('connection', socket => {
  console.log('connect', socket.id);

  socket.on('create-room', ({ name, avatar }) => {
    const code = generateRoomCode();
    const room = {
      code,
      status: 'waiting',
      hostId: socket.id,
      deck: [],
      board: [],
      currentPlayerIndex: 0,
      winner: null,
      players: [{
        id: socket.id,
        name,
        avatar,
        hand: [],
        hasInitialMeld: false,
        score: 0,
      }],
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit('room-updated', buildPublicState(room, socket.id));
  });

  socket.on('join-room', ({ code, name, avatar }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) return socket.emit('error', { message: 'Sala no encontrada.' });
    if (room.status === 'playing') return socket.emit('error', { message: 'Juego en curso, no se puede unir.' });
    if (room.players.length >= 4) return socket.emit('error', { message: 'Sala llena (máximo 4 jugadores).' });
    if (room.players.find(p => p.id === socket.id)) return;

    room.players.push({ id: socket.id, name, avatar, hand: [], hasInitialMeld: false, score: 0 });
    socket.join(code);
    emitRoomUpdate(room);
  });

  socket.on('start-game', ({ difficulty = 'easy' } = {}) => {
    const room = [...rooms.values()].find(r => r.players.some(p => p.id === socket.id));
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit('error', { message: 'Solo el host puede iniciar.' });
    if (room.players.length < 2) return socket.emit('error', { message: 'Mínimo 2 jugadores.' });
    if (room.status === 'playing') return;

    const deck = createDeck();
    let remaining = deck;
    for (const player of room.players) {
      const { tiles, remaining: rest } = dealTiles(remaining, 14);
      player.hand = tiles;
      player.hasInitialMeld = false;
      player.score = 0;
      remaining = rest;
    }
    room.deck = remaining;
    room.board = [];
    room.currentPlayerIndex = 0;
    room.winner = null;
    room.consecutivePasses = 0;
    room.status = 'playing';
    room.difficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'easy';
    room.turnStartedAt = Date.now();
    emitRoomUpdate(room);
  });

  socket.on('full-board-play', ({ removedMeldIndices, newMelds, handTileIds }) => {
    const room = [...rooms.values()].find(r => r.players.some(p => p.id === socket.id));
    if (!room || room.status !== 'playing') return;
    const currentPlayer = room.players[room.currentPlayerIndex];
    if (currentPlayer.id !== socket.id) return socket.emit('error', { message: 'No es tu turno.' });
    if (!currentPlayer.hasInitialMeld) return socket.emit('error', { message: 'Haz tu meld inicial primero.' });
    if (!Array.isArray(removedMeldIndices) || !Array.isArray(newMelds) || !Array.isArray(handTileIds)) {
      return socket.emit('error', { message: 'Datos inválidos.' });
    }
    if (handTileIds.length === 0) return socket.emit('error', { message: 'Debes usar al menos una ficha de tu mano.' });
    if (newMelds.length === 0) return socket.emit('error', { message: 'Debes crear al menos un meld.' });

    const uniqueRemovedIdx = [...new Set(removedMeldIndices)];
    const removedTiles = [];
    for (const idx of uniqueRemovedIdx) {
      if (!room.board[idx]) return socket.emit('error', { message: `Meld ${idx} no existe.` });
      removedTiles.push(...room.board[idx]);
    }

    const handMap = new Map(currentPlayer.hand.map(t => [t.id, t]));
    if (new Set(handTileIds).size !== handTileIds.length) return socket.emit('error', { message: 'Fichas de mano duplicadas.' });
    const handTiles = handTileIds.map(id => handMap.get(id));
    if (handTiles.some(t => !t)) return socket.emit('error', { message: 'Ficha de mano inválida.' });

    const allAvailable = [...removedTiles, ...handTiles];
    const availableMap = new Map(allAvailable.map(t => [t.id, t]));
    const availableIds = new Set(allAvailable.map(t => t.id));
    const usedIds = new Set(newMelds.flat());

    for (const id of availableIds) {
      if (!usedIds.has(id)) return socket.emit('error', { message: 'Ficha del tablero sin asignar a nuevo meld.' });
    }
    for (const id of usedIds) {
      if (!availableIds.has(id)) return socket.emit('error', { message: 'Ficha no disponible en nuevos melds.' });
    }

    const newMeldTiles = newMelds.map(ids => ids.map(id => availableMap.get(id)));
    for (const meld of newMeldTiles) {
      if (!isValidMeld(meld)) return socket.emit('error', { message: 'Meld inválido en la nueva disposición.' });
    }

    const playedIdSet = new Set(handTileIds);
    currentPlayer.hand = currentPlayer.hand.filter(t => !playedIdSet.has(t.id));

    for (const idx of [...uniqueRemovedIdx].sort((a, b) => b - a)) {
      room.board.splice(idx, 1);
    }
    for (const meld of newMeldTiles) room.board.push(meld);

    room.consecutivePasses = 0;
    if (!checkWin(room, socket.id)) nextPlayer(room);
    emitRoomUpdate(room);
  });

  socket.on('play-melds', ({ melds }) => {
    const room = [...rooms.values()].find(r => r.players.some(p => p.id === socket.id));
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.players[room.currentPlayerIndex];
    if (currentPlayer.id !== socket.id) return socket.emit('error', { message: 'No es tu turno.' });
    if (!melds || melds.length === 0) return socket.emit('error', { message: 'Debes jugar al menos un meld.' });

    // Collect all tile IDs being played
    const allPlayedIds = melds.flat();
    const playerHandIds = new Set(currentPlayer.hand.map(t => t.id));

    // Validate all IDs exist in hand
    for (const id of allPlayedIds) {
      if (!playerHandIds.has(id)) return socket.emit('error', { message: 'Ficha inválida.' });
    }

    // Check for duplicate IDs across melds
    if (new Set(allPlayedIds).size !== allPlayedIds.length) {
      return socket.emit('error', { message: 'Ficha duplicada en melds.' });
    }

    // Build tile objects for each meld
    const handMap = new Map(currentPlayer.hand.map(t => [t.id, t]));
    const meldTiles = melds.map(ids => ids.map(id => handMap.get(id)));

    // Validate each meld
    for (const meld of meldTiles) {
      if (!isValidMeld(meld)) {
        return socket.emit('error', { message: 'Meld inválido. Verifica grupos y escaleras.' });
      }
    }

    // Check initial meld requirement (≥30 points)
    if (!currentPlayer.hasInitialMeld) {
      const total = meldTiles.reduce((sum, meld) => sum + calculateScore(meld), 0);
      if (total < 30) {
        return socket.emit('error', { message: `Primer meld debe sumar ≥30 puntos. Tienes ${total}.` });
      }
      currentPlayer.hasInitialMeld = true;
    }

    // Apply: remove tiles from hand, add melds to board
    const playedIdSet = new Set(allPlayedIds);
    currentPlayer.hand = currentPlayer.hand.filter(t => !playedIdSet.has(t.id));
    for (const meld of meldTiles) {
      room.board.push(meld);
    }

    room.consecutivePasses = 0;
    if (!checkWin(room, socket.id)) {
      nextPlayer(room);
    }
    emitRoomUpdate(room);
  });

  socket.on('draw-tile', () => {
    const room = [...rooms.values()].find(r => r.players.some(p => p.id === socket.id));
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.players[room.currentPlayerIndex];
    if (currentPlayer.id !== socket.id) return socket.emit('error', { message: 'No es tu turno.' });

    if (room.deck.length > 0) {
      const [tile, ...rest] = room.deck;
      room.deck = rest;
      currentPlayer.hand.push(tile);
      room.consecutivePasses = 0;
    } else {
      room.consecutivePasses = (room.consecutivePasses || 0) + 1;
      if (room.consecutivePasses >= room.players.length) {
        room.status = 'ended';
        for (const p of room.players) p.score = calculateScore(p.hand);
        const lowestScore = Math.min(...room.players.map(p => p.score));
        room.winner = room.players.find(p => p.score === lowestScore)?.id ?? null;
        emitRoomUpdate(room);
        return;
      }
    }

    nextPlayer(room);
    emitRoomUpdate(room);
  });

  socket.on('play-again', () => {
    const room = [...rooms.values()].find(r => r.players.some(p => p.id === socket.id));
    if (!room) return;
    if (room.status !== 'ended') return;
    if (room.hostId !== socket.id) return socket.emit('error', { message: 'Solo el host puede reiniciar.' });

    const deck = createDeck();
    let remaining = deck;
    for (const player of room.players) {
      const { tiles, remaining: rest } = dealTiles(remaining, 14);
      player.hand = tiles;
      player.hasInitialMeld = false;
      player.score = 0;
      remaining = rest;
    }
    room.deck = remaining;
    room.board = [];
    room.currentPlayerIndex = 0;
    room.winner = null;
    room.consecutivePasses = 0;
    room.status = 'playing';
    room.turnStartedAt = Date.now();
    emitRoomUpdate(room);
  });

  socket.on('update-draft', ({ zones, affectedMeldIndices }) => {
    const room = [...rooms.values()].find(r => r.players.some(p => p.id === socket.id));
    if (!room) return;
    socket.to(room.code).emit('draft-updated', {
      playerId: socket.id,
      zones: zones.map(z => ({
        id: z.id,
        tiles: z.tiles,
      })),
      affectedMeldIndices,
    });
  });

  socket.on('leave-room', () => {
    handleDisconnect(socket.id);
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    handleDisconnect(socket.id);
  });

  function handleDisconnect(socketId) {
    for (const [code, room] of rooms.entries()) {
      const idx = room.players.findIndex(p => p.id === socketId);
      if (idx === -1) continue;

      room.players.splice(idx, 1);

      if (room.players.length === 0) {
        rooms.delete(code);
        return;
      }

      // Reassign host if needed
      if (room.hostId === socketId) {
        room.hostId = room.players[0].id;
      }

      // Fix currentPlayerIndex
      if (room.currentPlayerIndex >= room.players.length) {
        room.currentPlayerIndex = 0;
      }

      // End game if not enough players
      if (room.status === 'playing' && room.players.length < 2) {
        room.status = 'ended';
        room.winner = room.players[0]?.id ?? null;
      }

      emitRoomUpdate(room);
      return;
    }
  }
});

app.get(/^(?!\/socket\.io).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
