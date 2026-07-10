import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import socket from '../socket.js'
import { isValidMeld, calculateScore, tryReplaceJoker } from '../game/rummikubEngine.js'
import { TAP, HOVER } from '../motion.js'

const DIFF_SECS = { easy: 120, medium: 90, hard: 40 }
const COLOR_ORDER = { red: 0, blue: 1, black: 2, yellow: 3 }
const NUM_COLOR = { red: '#E53935', blue: '#2196F3', black: '#212121', yellow: '#EAB308' }

function timerLevel(left, total) {
  return left <= 10 ? 'red' : left <= total * 0.3 ? 'amber' : 'green'
}
const RING_COLOR = { red: '#EF4444', amber: '#F59E0B', green: '#22C55E' }
const BAR_COLOR = { red: '#DC2626', amber: '#D97706', green: '#16A34A' }
const TEXT_COLOR = { red: '#B91C1C', amber: '#B45309', green: '#166534' }

let _zoneId = 0
function nextZoneId() { return `z-${++_zoneId}` }

function sameDraft(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (a.playerId !== b.playerId) return false
  if (a.affectedMeldIndices?.length !== b.affectedMeldIndices?.length) return false
  if (a.affectedMeldIndices?.some((v, i) => v !== b.affectedMeldIndices[i])) return false
  if (a.zones?.length !== b.zones?.length) return false
  return a.zones.every((za, i) => {
    const zb = b.zones[i]
    if (!zb || za.id !== zb.id || za.tiles.length !== zb.tiles.length) return false
    return za.tiles.every((t, j) => t.id === zb.tiles[j]?.id)
  })
}

function useSounds() {
  const ctxRef = useRef(null)
  return useCallback((type) => {
    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      const tone = (freq, start, dur, vol = 0.12, wave = 'sine') => {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = wave; o.frequency.setValueAtTime(freq, now + start)
        g.gain.setValueAtTime(vol, now + start)
        g.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
        o.start(now + start); o.stop(now + start + dur)
      }
      switch (type) {
        case 'place':   tone(600, 0, 0.09, 0.08, 'triangle'); break
        case 'take':    tone(320, 0, 0.1, 0.1, 'triangle'); tone(200, 0.07, 0.1, 0.07, 'triangle'); break
        case 'draw':    tone(440, 0, 0.08, 0.1); tone(330, 0.07, 0.12, 0.08); break
        case 'meld':    [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.18, 0.14)); break
        case 'confirm': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.2, 0.17)); break
        case 'error':   tone(220, 0, 0.15, 0.1, 'sawtooth'); tone(165, 0.12, 0.18, 0.08, 'sawtooth'); break
        case 'turn':    tone(880, 0, 0.2, 0.14); tone(1108, 0.18, 0.28, 0.16); break
        case 'tick':    tone(1000, 0, 0.08, 0.2, 'square'); break
        case 'urgent':  tone(1200, 0, 0.1, 0.25, 'square'); tone(800, 0.1, 0.12, 0.2, 'square'); break
        default: break
      }
    } catch { /* AudioContext unavailable */ }
  }, [])
}

function useTimer(turnStartedAt, total, active) {
  const [left, setLeft] = useState(total)
  useEffect(() => {
    if (!active || !turnStartedAt) { setLeft(total); return }
    const tick = () => setLeft(Math.max(0, Math.ceil(total - (Date.now() - turnStartedAt) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [turnStartedAt, total, active])
  return left
}

function CircularTimer({ left, total }) {
  const r = 34, circ = 2 * Math.PI * r
  const pct = Math.max(0, left / total)
  const color = RING_COLOR[timerLevel(left, total)]
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0 pointer-events-none">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s' }} />
    </svg>
  )
}

const PlayerAvatar = memo(function PlayerAvatar({ player, isCurrent, isMe, left, total }) {
  const urgent = left <= 10
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 100 }}>
      <div className="relative w-20 h-20">
        {isCurrent && <CircularTimer left={left} total={total} />}
        <div className={`w-full h-full rounded-full overflow-hidden border-[3px] transition-all
          ${isCurrent
            ? (urgent
              ? 'border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.6)]'
              : 'border-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.5)]')
            : 'border-white/15'}`}
        >
          {player.avatar?.url
            ? <img src={player.avatar.url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-3xl bg-white/5">👤</div>}
        </div>
        {isCurrent && (
          <div className="absolute inset-0 grid place-content-center bg-black/50 rounded-full">
            <span className={`font-heading text-xl font-bold ${urgent ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {left}
            </span>
          </div>
        )}
      </div>
      <div className={`w-full rounded-lg px-3 py-2 flex justify-between items-center gap-1 mt-2 transition-all
        ${isCurrent
          ? (urgent
            ? 'bg-red-950/60 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
            : 'bg-purple-950/60 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]')
          : 'bg-black/40 border border-white/5'}`}
      >
        <span className={`text-xs font-semibold truncate max-w-[64px] ${isMe ? 'text-purple-300' : 'text-white'}`}>
          {player.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0" style={{ fontSize: 10, color: '#94A3B8' }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {player.handCount}
          {player.hasInitialMeld && <span className="text-green-400">✓</span>}
        </div>
      </div>
    </div>
  )
})

const CreamTile = memo(function CreamTile({ tile, className = '', style = {}, ...rest }) {
  const colorCls = tile.isJoker ? 'ctile-joker' : `ctile-${tile.color}`
  return (
    <div className={`ctile ${colorCls} ${className}`} style={style} {...rest}>
      {tile.isJoker ? '★' : tile.number}
    </div>
  )
})

const BoardMeld = memo(function BoardMeld({ meld, originalIdx, isDropTarget, canInteract, draggingTileId, onTileDragStart, onMeldDragStart, onMeldDragEnd, onDrop, onDragOverMeld, onTileTouchStart, onMeldTouchStart }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-1"
    >
      <div
        className={`flex gap-1 p-2 rounded-xl border transition-all duration-150
          ${isDropTarget ? 'meld-drop-active' : 'border-white/10 bg-white/5'}
          ${canInteract ? 'cursor-pointer' : ''}
          `}
        draggable={canInteract}
        data-drop-type="meld"
        data-meld-idx={originalIdx}
        onDragStart={canInteract ? (e) => onMeldDragStart(e, originalIdx) : undefined}
        onDragEnd={canInteract ? onMeldDragEnd : undefined}
        onDragOver={canInteract ? (e) => { e.preventDefault(); e.stopPropagation(); onDragOverMeld && onDragOverMeld(e, originalIdx) } : undefined}
        onDrop={canInteract ? (e) => onDrop(e, originalIdx) : undefined}
        onTouchStart={canInteract ? (e) => onMeldTouchStart(e, originalIdx) : undefined}
        style={{ touchAction: canInteract ? 'none' : 'auto' }}
        title={canInteract ? 'Arrastra fichas de tu mano para añadir, o arrastra una ficha para tomar' : undefined}
      >
        {meld.map((tile, tileIdx) => (
          <CreamTile
            key={tile.id}
            tile={tile}
            className={`board-ctile ${draggingTileId === tile.id ? 'opacity-30' : ''}`}
            draggable={canInteract}
            onDragStart={canInteract ? (e) => { e.stopPropagation(); onTileDragStart(e, originalIdx, tile, tileIdx) } : undefined}
            onDragEnd={canInteract ? onMeldDragEnd : undefined}
            onTouchStart={canInteract ? (e) => { e.stopPropagation(); onTileTouchStart(e, originalIdx, tile) } : undefined}
            style={{
              pointerEvents: canInteract ? 'auto' : 'none',
              cursor: canInteract ? 'grab' : 'default',
              touchAction: canInteract ? 'none' : 'auto',
            }}
          />
        ))}
      </div>

    </motion.div>
  )
})

const Zone = memo(function Zone({ zone, canInteract, isDropTarget, dragTileId, onZoneDrop, onTileDragStart, onTileDragEnd, onDoubleClickTile, fromBoard, onTileTouchStart }) {
  const valid = zone.tiles.length >= 3 && isValidMeld(zone.tiles)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-1"
    >
      <div
        className={`flex gap-1 p-2 rounded-xl border-2 transition-all duration-150
          ${isDropTarget ? 'meld-drop-active' : valid ? 'border-green-500/60 bg-green-900/20' : 'border-red-500/40 bg-red-900/10'}`}
        data-drop-type="zone"
        data-zone-id={zone.id}
        data-insert-at={zone.tiles.length}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
        onDrop={(e) => onZoneDrop(e, zone.id, zone.tiles.length)}
      >
        {zone.tiles.map((tile, idx) => (
          <CreamTile
            key={tile.id}
            tile={tile}
            className={`board-ctile ${dragTileId === tile.id ? 'opacity-30' : ''}`}
            draggable={canInteract}
            data-drop-type="zone"
            data-zone-id={zone.id}
            data-insert-at={idx}
            onDragStart={canInteract ? (e) => onTileDragStart(e, zone.id, tile, idx) : undefined}
            onDragEnd={canInteract ? onTileDragEnd : undefined}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onZoneDrop(e, zone.id, idx) }}
            onTouchStart={canInteract ? (e) => { e.stopPropagation(); onTileTouchStart(e, zone.id, tile) } : undefined}
            onDoubleClick={() => canInteract && onDoubleClickTile(zone.id, tile.id)}
            style={{
              cursor: canInteract ? 'grab' : 'default',
              touchAction: canInteract ? 'none' : 'auto',
              ...(fromBoard.has(tile.id) ? { outline: '2px solid rgba(59,130,246,0.6)', outlineOffset: 1 } : {}),
            }}
            title={fromBoard.has(tile.id) ? 'Ficha del tablero' : 'Doble clic para devolver a mano'}
          />
        ))}
      </div>
    </motion.div>
  )
})

export default function GameScreen({ roomState, socketId, error, clearError }) {
  const sound = useSounds()

  const [zones, setZones] = useState([])
  const [affectedMeldIndices, setAffectedMeldIndices] = useState([])
  const [sortBy, setSortBy] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [dragTileId, setDragTileId] = useState(null)
  const [localError, setLocalError] = useState(null)
  const [drawnTileId, setDrawnTileId] = useState(null)
  const [opponentDraft, setOpponentDraft] = useState(null)
  const [turnFlash, setTurnFlash] = useState(false)
  const [touchPreviewPos, setTouchPreviewPos] = useState(null)

  const autoDrawnRef = useRef(false)
  const pendingDrawRef = useRef(false)
  const prevHandRef = useRef([])
  const prevIsMyTurnRef = useRef(false)
  const dragFrom = useRef(null)
  const dragMeldIdx = useRef(null)
  const dragZoneIdRef = useRef(null)
  const handleEndTurnRef = useRef()
  const touchDragRef = useRef(null)
  const touchStartPosRef = useRef({ x: 0, y: 0 })
  const touchActiveRef = useRef(false)
  const liveRef = useRef({})
  const pendingTouchPosRef = useRef(null)
  const touchRafIdRef = useRef(null)

  const me = roomState?.players?.find(p => p.id === socketId)
  const isMyTurn = roomState?.currentPlayerId === socketId
  const myHand = roomState?.yourHand ?? []
  const board = roomState?.board ?? []
  const currentPlayer = roomState?.players?.find(p => p.id === roomState?.currentPlayerId)
  const totalSecs = DIFF_SECS[roomState?.difficulty] ?? 120
  const isPlaying = roomState?.status === 'playing'
  const handMap = useMemo(() => new Map(myHand.map(t => [t.id, t])), [myHand])
  const timeLeft = useTimer(roomState?.turnStartedAt, totalSecs, isPlaying)

  const zoneTileIds = useMemo(() => new Set(zones.flatMap(z => z.tiles.filter(Boolean).map(t => t.id))), [zones])
  const hasChanges = zones.length > 0 || affectedMeldIndices.length > 0
  const canInteractWithBoard = isMyTurn && (me?.hasInitialMeld ?? false)

  const handTileIdsInZones = useMemo(
    () => new Set(zones.flatMap(z => z.tiles.filter(Boolean).filter(t => handMap.has(t.id)).map(t => t.id))),
    [zones, handMap]
  )

  const boardTileIdsInZones = useMemo(
    () => new Set(zones.flatMap(z => z.tiles.filter(Boolean).filter(t => !handMap.has(t.id)).map(t => t.id))),
    [zones, handMap]
  )

  const initialMeldHandScore = useMemo(
    () => calculateScore(zones.flatMap(z => z.tiles.filter(Boolean).filter(t => handMap.has(t.id)))),
    [zones, handMap]
  )
  const meetsInitialMeld = (me?.hasInitialMeld ?? false) || initialMeldHandScore >= 30

  const allAffectedTilesInZones = useMemo(
    () => affectedMeldIndices.length === 0 ||
      affectedMeldIndices.every(i => (board[i] || []).every(t => zoneTileIds.has(t.id))),
    [affectedMeldIndices, board, zoneTileIds]
  )

  const canFinalizeTurn = useMemo(() => hasChanges &&
    zones.every(z => z.tiles.length >= 3 && isValidMeld(z.tiles)) &&
    (affectedMeldIndices.length > 0 ? allAffectedTilesInZones : boardTileIdsInZones.size === 0) &&
    (affectedMeldIndices.length === 0 || handTileIdsInZones.size > 0) &&
    meetsInitialMeld,
    [hasChanges, zones, affectedMeldIndices, allAffectedTilesInZones, boardTileIdsInZones, handTileIdsInZones, meetsInitialMeld]
  )

  const opponentAffectedSet = useMemo(
    () => new Set(opponentDraft?.affectedMeldIndices ?? []),
    [opponentDraft]
  )

  const visibleBoard = useMemo(
    () => board
      .map((meld, i) => ({ meld, i, key: meld.map(t => t.id).join('_') }))
      .filter(({ i }) => !affectedMeldIndices.includes(i) && !opponentAffectedSet.has(i)),
    [board, affectedMeldIndices, opponentAffectedSet]
  )

  const allZoneBoardTileIds = useMemo(() => {
    const ids = new Set()
    for (const z of zones) {
      for (const t of z.tiles) {
        if (!handMap.has(t.id)) ids.add(t.id)
      }
    }
    return ids
  }, [zones, handMap])

  const displayHand = useMemo(() => {
    const hand = [...myHand]
    if (sortBy === 'number') {
      hand.sort((a, b) => {
        if (a.isJoker && b.isJoker) return 0
        if (a.isJoker) return 1; if (b.isJoker) return -1
        return a.number - b.number || (COLOR_ORDER[a.color] ?? 4) - (COLOR_ORDER[b.color] ?? 4)
      })
    } else if (sortBy === 'color') {
      hand.sort((a, b) => {
        if (a.isJoker && b.isJoker) return 0
        if (a.isJoker) return 1; if (b.isJoker) return -1
        return (COLOR_ORDER[a.color] ?? 4) - (COLOR_ORDER[b.color] ?? 4) || a.number - b.number
      })
    }
    return hand
  }, [myHand, sortBy])

  useEffect(() => {
    setZones([])
    setAffectedMeldIndices([])
    setOpponentDraft(null)
    setDropTarget(null)
    setLocalError(null)
    autoDrawnRef.current = false
  }, [roomState?.currentPlayerId])

  useEffect(() => {
    if (pendingDrawRef.current && myHand.length > prevHandRef.current.length) {
      const prevIds = new Set(prevHandRef.current.map(t => t.id))
      const newTile = myHand.find(t => !prevIds.has(t.id))
      if (newTile) {
        pendingDrawRef.current = false
        setDrawnTileId(newTile.id)
        setTimeout(() => setDrawnTileId(null), 2600)
      }
    }
    prevHandRef.current = myHand
  }, [myHand])

  const prevCountdownRef = useRef(null)
  useEffect(() => {
    if (!isMyTurn || !isPlaying || timeLeft <= 0) return
    if (timeLeft <= 10) {
      if (prevCountdownRef.current !== timeLeft) {
        sound('tick')
        prevCountdownRef.current = timeLeft
      }
    } else {
      prevCountdownRef.current = null
    }
  }, [timeLeft, isMyTurn, isPlaying, sound])

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current && isPlaying) {
      sound('turn')
      setTurnFlash(true)
      prevIsMyTurnRef.current = isMyTurn
      const id = setTimeout(() => setTurnFlash(false), 900)
      return () => clearTimeout(id)
    }
    prevIsMyTurnRef.current = isMyTurn
  }, [isMyTurn, isPlaying, sound])

  useEffect(() => {
    if (!isMyTurn || !isPlaying || !roomState?.turnStartedAt) return
    const id = setInterval(() => {
      if (autoDrawnRef.current) return
      if ((Date.now() - roomState.turnStartedAt) / 1000 >= totalSecs) {
        autoDrawnRef.current = true
        handleEndTurnRef.current(true)
      }
    }, 500)
    return () => clearInterval(id)
  }, [isMyTurn, isPlaying, roomState?.turnStartedAt, totalSecs])

  useEffect(() => { if (error) { setLocalError(error); clearError() } }, [error])

  useEffect(() => {
    const handler = (draft) => {
      if (draft.playerId !== socketId) {
        setOpponentDraft(prev => sameDraft(prev, draft) ? prev : draft)
      }
    }
    socket.on('draft-updated', handler)
    return () => socket.off('draft-updated', handler)
  }, [socketId])

  const prevBoardRef = useRef(null)
  useEffect(() => {
    const boardStr = JSON.stringify(board)
    if (prevBoardRef.current !== null && prevBoardRef.current !== boardStr) {
      setOpponentDraft(null)
    }
    prevBoardRef.current = boardStr
  }, [board])

  const emitDraftRef = useRef(null)
  useEffect(() => {
    if (!isMyTurn || !isPlaying) { setOpponentDraft(null); return }
    if (emitDraftRef.current) clearTimeout(emitDraftRef.current)
    emitDraftRef.current = setTimeout(() => {
      socket.emit('update-draft', {
        zones: zones.map(z => ({ id: z.id, tiles: z.tiles })),
        affectedMeldIndices,
      })
    }, 150)
    return () => { if (emitDraftRef.current) clearTimeout(emitDraftRef.current) }
  }, [zones, affectedMeldIndices, isMyTurn, isPlaying])

  function showError(msg) {
    sound('error')
    setLocalError(msg)
    setTimeout(() => setLocalError(null), 3500)
  }

  function clearAllState() {
    setZones([])
    setAffectedMeldIndices([])
    setLocalError(null)
    setDropTarget(null)
  }

  function sortTiles(tiles) {
    const seen = new Set()
    const unique = tiles.filter(t => {
      if (!t || seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    const nonJokers = unique.filter(t => !t.isJoker)
    const jokers = unique.filter(t => t.isJoker)
    const sortByNumColor = arr => [...arr].sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number
      return (COLOR_ORDER[a.color] ?? 4) - (COLOR_ORDER[b.color] ?? 4)
    })
    if (jokers.length === 0 || nonJokers.length < 2) {
      return sortByNumColor(unique)
    }
    const colors = new Set(nonJokers.map(t => t.color))
    if (colors.size !== 1) {
      return [...sortByNumColor(nonJokers), ...jokers]
    }
    const sorted = [...nonJokers].sort((a, b) => a.number - b.number)
    let gaps = 0
    for (let i = 1; i < sorted.length; i++) {
      gaps += sorted[i].number - sorted[i - 1].number - 1
    }
    const extra = jokers.length - gaps
    const min = sorted[0].number
    const max = sorted[sorted.length - 1].number
    let extraBefore = extra
    let extraAfter = 0
    for (let b = 0; b <= extra; b++) {
      const start = min - b
      const end = max + (extra - b)
      if (start >= 1 && end <= 13) {
        extraBefore = b
        extraAfter = extra - b
        break
      }
    }
    const result = []
    let jIdx = 0
    for (let i = 0; i < extraBefore; i++) result.push(jokers[jIdx++])
    for (let i = 0; i < sorted.length; i++) {
      result.push(sorted[i])
      if (i < sorted.length - 1) {
        const gap = sorted[i + 1].number - sorted[i].number - 1
        for (let g = 0; g < Math.min(gap, jokers.length - jIdx); g++) result.push(jokers[jIdx++])
      }
    }
    for (let i = 0; i < extraAfter; i++) result.push(jokers[jIdx++])
    while (jIdx < jokers.length) result.push(jokers[jIdx++])
    return result
  }

  function createZone(tiles) {
    const id = nextZoneId()
    const clean = tiles.filter(Boolean)
    setZones(prev => [...prev, { id, tiles: sortTiles(clean) }])
    return id
  }

  function addTilesToZone(zoneId, tiles, insertAt) {
    const clean = tiles.filter(Boolean)
    setZones(prev => prev.map(z => {
      if (z.id !== zoneId) return z
      const existingIds = new Set(z.tiles.map(t => t.id))
      const toAdd = clean.filter(t => !existingIds.has(t.id))
      if (toAdd.length === 0) return z
      let newTiles
      if (insertAt !== undefined && insertAt >= 0 && insertAt <= z.tiles.length) {
        newTiles = [...z.tiles.slice(0, insertAt), ...toAdd, ...z.tiles.slice(insertAt)]
      } else {
        newTiles = [...z.tiles, ...toAdd]
      }
      return { ...z, tiles: sortTiles(newTiles) }
    }))
  }

  function removeTileFromZone(zoneId, tileId) {
    let removed = false
    setZones(prev => {
      const newZones = prev.map(z => {
        if (z.id !== zoneId) return z
        const filtered = z.tiles.filter(t => t.id !== tileId)
        if (filtered.length !== z.tiles.length) removed = true
        return { ...z, tiles: filtered }
      }).filter(z => z.tiles.length > 0)
      return newZones
    })
    return removed
  }

  function affectMeld(meldIdx) {
    setAffectedMeldIndices(prev => prev.includes(meldIdx) ? prev : [...prev, meldIdx])
  }

  function handleRackTileDropOnBoard(tileId, targetZoneId, insertAt) {
    const tile = handMap.get(tileId)
    if (!tile || zoneTileIds.has(tileId)) return

    sound('place')
    const handTilesOnly = !me?.hasInitialMeld

    if (targetZoneId) {
      addTilesToZone(targetZoneId, [tile], insertAt)
    } else {
      const zid = createZone([tile])

    }
  }

  function handleBoardTileDrop(tileId, meldIdx, targetZoneId, insertAt) {
    const meld = board[meldIdx]
    if (!meld || !canInteractWithBoard) return

    sound('take')
    affectMeld(meldIdx)

    const tileIdx = meld.findIndex(t => t.id === tileId)
    if (tileIdx === -1) return
    const draggedTile = meld[tileIdx]
    const before = meld.slice(0, tileIdx)
    const after = meld.slice(tileIdx + 1)

    if (targetZoneId) {
      addTilesToZone(targetZoneId, [draggedTile], insertAt)
      if (before.length > 0) createZone(before)
      if (after.length > 0) createZone(after)
    } else {
      createZone([draggedTile])
      if (before.length > 0) createZone(before)
      if (after.length > 0) createZone(after)
    }
  }

  function handleBoardMeldDropOnMeld(rackTileId, meldIdx) {
    if (!canInteractWithBoard) return
    const meld = board[meldIdx]
    if (!meld) return
    const tile = handMap.get(rackTileId)
    if (!tile) return

    if (meld.some(t => t.isJoker)) {
      const replacement = tryReplaceJoker(meld, tile)
      if (replacement) {
        sound('confirm')
        affectMeld(meldIdx)
        const newMeld = meld.map((t, i) => i === replacement.jokerIndex ? tile : t)
        const freedJoker = meld[replacement.jokerIndex]
        createZone(newMeld)
        createZone([freedJoker])
        return
      }
    }

    sound('place')
    affectMeld(meldIdx)
    createZone([...meld, tile])
  }

  function handleBoardTileDropOnMeld(tileId, srcMeldIdx, targetMeldIdx) {
    if (srcMeldIdx === targetMeldIdx) return
    const srcMeld = board[srcMeldIdx]
    const targetMeld = board[targetMeldIdx]
    if (!srcMeld || !targetMeld || !canInteractWithBoard) return

    sound('place')
    affectMeld(srcMeldIdx)
    affectMeld(targetMeldIdx)

    const tileIdx = srcMeld.findIndex(t => t.id === tileId)
    if (tileIdx === -1) return
    const draggedTile = srcMeld[tileIdx]
    const before = srcMeld.slice(0, tileIdx)
    const after = srcMeld.slice(tileIdx + 1)

    createZone([...targetMeld, draggedTile])
    if (before.length > 0) createZone(before)
    if (after.length > 0) createZone(after)
  }

  function handleZoneTileDropOnMeld(tileId, srcZoneId, targetMeldIdx) {
    const targetMeld = board[targetMeldIdx]
    if (!targetMeld || !isMyTurn) return

    const tile = zones.find(z => z.id === srcZoneId)?.tiles.find(t => t.id === tileId)
    if (!tile) return

    sound('place')
    affectMeld(targetMeldIdx)
    removeTileFromZone(srcZoneId, tileId)
    createZone([...targetMeld, tile])
  }

  function handleTakeMeld(meldIdx) {
    if (!canInteractWithBoard) return
    const meld = board[meldIdx]
    if (!meld) return

    sound('take')
    affectMeld(meldIdx)
    createZone([...meld])
  }

  function handleZoneTileDrop(tileId, sourceZoneId, targetZoneId, insertAt) {
    if (sourceZoneId === targetZoneId) {
      if (insertAt === undefined) return
      setZones(prev => prev.map(z => {
        if (z.id !== sourceZoneId) return z
        const idx = z.tiles.findIndex(t => t.id === tileId)
        if (idx === -1) return z
        const newTiles = [...z.tiles]
        const [moved] = newTiles.splice(idx, 1)
        const pos = insertAt > idx ? insertAt - 1 : insertAt
        newTiles.splice(Math.min(pos, newTiles.length), 0, moved)
        return { ...z, tiles: newTiles }
      }))
    } else {
      const tile = zones.find(z => z.id === sourceZoneId)?.tiles.find(t => t.id === tileId)
      if (!tile) return
      removeTileFromZone(sourceZoneId, tileId)
      addTilesToZone(targetZoneId, [tile], insertAt)
    }
  }

  const handleDoubleClickZoneTile = useCallback((zoneId, tileId) => {
    if (!handMap.has(tileId)) return
    removeTileFromZone(zoneId, tileId)
    sound('place')
  }, [handMap, sound])

  function handleUndo() {
    if (!isMyTurn || zones.length === 0) return
    clearAllState()
    sound('place')
  }

  function handleEndTurn(isTimeout) {
    if (!isMyTurn) return

    if (!hasChanges) {
      if (isTimeout) {
        pendingDrawRef.current = true
        socket.emit('draw-tile')
      }
      return
    }

    if (isTimeout) {
      const validZones = zones.filter(z => z.tiles.length >= 3 && isValidMeld(z.tiles))
      if (validZones.length === 0) {
        revertTurn('Tiempo agotado. No hay jugadas válidas.')
        return
      }
      const validTileIds = new Set(validZones.flatMap(z => z.tiles.map(t => t.id)))
      const validHandIds = [...handTileIdsInZones].filter(id => validTileIds.has(id))

      if (affectedMeldIndices.length > 0) {
        const allAffectedInValid = affectedMeldIndices.every(i =>
          (board[i] || []).every(t => validTileIds.has(t.id))
        )
        if (!allAffectedInValid || validHandIds.length === 0) {
          revertTurn('Tiempo agotado. Reorganización del tablero incompleta.')
          return
        }
        sound('confirm')
        socket.emit('full-board-play', {
          removedMeldIndices: affectedMeldIndices,
          newMelds: validZones.map(z => z.tiles.map(t => t.id)),
          handTileIds: validHandIds,
        })
      } else {
        const handScore = calculateScore(validZones.flatMap(z =>
          z.tiles.filter(t => handMap.has(t.id))
        ))
        if (!me?.hasInitialMeld && handScore < 30) {
          revertTurn(`Tiempo agotado. Primer meld no llega a 30 pts (tienes ${handScore}).`)
          return
        }
        sound('confirm')
        socket.emit('play-melds', { melds: validZones.map(z => z.tiles.map(t => t.id)) })
      }
      return
    }

    const invalidZones = zones.filter(z => z.tiles.length < 3 || !isValidMeld(z.tiles))
    const badBoardTiles = affectedMeldIndices.length > 0
      ? !allAffectedTilesInZones
      : boardTileIdsInZones.size > 0

    if (invalidZones.length > 0 || badBoardTiles) {
      revertTurn('Jugada inválida. Se revirtió el tablero y robaste una ficha.')
      return
    }

    if (affectedMeldIndices.length > 0 && handTileIdsInZones.size === 0) {
      revertTurn('Debes usar al menos una ficha de tu mano al reorganizar el tablero.')
      return
    }

    if (!me?.hasInitialMeld && initialMeldHandScore < 30) {
      revertTurn(`Primera bajada necesita ≥30 pts de tu mano. Tienes ${initialMeldHandScore}.`)
      return
    }

    sound('confirm')

    const newMelds = zones.filter(z => z.tiles.length >= 3 && isValidMeld(z.tiles)).map(z => z.tiles.map(t => t.id))

    if (affectedMeldIndices.length > 0) {
      socket.emit('full-board-play', {
        removedMeldIndices: affectedMeldIndices,
        newMelds,
        handTileIds: [...handTileIdsInZones],
      })
    } else {
      socket.emit('play-melds', { melds: newMelds })
    }
  }
  handleEndTurnRef.current = handleEndTurn

  function revertTurn(msg) {
    clearAllState()
    pendingDrawRef.current = true
    sound('draw')
    socket.emit('draw-tile')
    showError(msg || 'Jugada inválida. Se revirtió y robaste una ficha.')
  }

  function drawTile() {
    clearAllState()
    pendingDrawRef.current = true
    sound('draw')
    socket.emit('draw-tile')
  }

  function onRackDragStart(e, tile) {
    if (!isMyTurn || zoneTileIds.has(tile.id)) { e.preventDefault(); return }
    dragFrom.current = 'rack'
    setDragTileId(tile.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'rack', tileId: tile.id }))
  }

  const onBoardTileDragStart = useCallback((e, meldIdx, tile) => {
    if (!canInteractWithBoard) { e.preventDefault(); return }
    dragFrom.current = 'boardTile'
    dragMeldIdx.current = meldIdx
    setDragTileId(tile.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'boardTile', meldIdx, tileId: tile.id }))
  }, [canInteractWithBoard])

  const onBoardMeldDragStart = useCallback((e, meldIdx) => {
    if (!canInteractWithBoard) { e.preventDefault(); return }
    dragFrom.current = 'boardMeld'
    dragMeldIdx.current = meldIdx
    setDragTileId(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'boardMeld', meldIdx }))
  }, [canInteractWithBoard])

  const onZoneTileDragStart = useCallback((e, zoneId, tile) => {
    dragFrom.current = 'zoneTile'
    dragZoneIdRef.current = zoneId
    setDragTileId(tile.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'zoneTile', zoneId, tileId: tile.id }))
  }, [])

  const onDragEnd = useCallback(() => {
    setDragTileId(null)
    setDropTarget(null)
    dragFrom.current = null
    dragMeldIdx.current = null
    dragZoneIdRef.current = null
  }, [])

  function handleTouchStart(data, tile, touch) {
    touchDragRef.current = { data, tile }
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
    touchActiveRef.current = false
    setDragTileId(tile?.id ?? null)
  }

  function onRackTouchStart(e, tile) {
    const t = e.touches[0]
    if (!t) return
    handleTouchStart({ type: 'rack', tileId: tile.id }, tile, t)
  }

  const onBoardTileTouchStart = useCallback((e, meldIdx, tile) => {
    const t = e.touches[0]
    if (!t) return
    handleTouchStart({ type: 'boardTile', meldIdx, tileId: tile.id }, tile, t)
  }, [])

  const onBoardMeldTouchStart = useCallback((e, meldIdx) => {
    const t = e.touches[0]
    if (!t) return
    handleTouchStart({ type: 'boardMeld', meldIdx }, null, t)
  }, [])

  const onZoneTileTouchStart = useCallback((e, zoneId, tile) => {
    const t = e.touches[0]
    if (!t) return
    handleTouchStart({ type: 'zoneTile', zoneId, tileId: tile.id }, tile, t)
  }, [])

  function parseDragData(e) {
    try {
      return JSON.parse(e.dataTransfer.getData('text/plain'))
    } catch {
      const raw = e.dataTransfer.getData('text/plain')
      if (raw && !raw.startsWith('{')) {
        return { type: 'rack', tileId: raw }
      }
      return null
    }
  }

  function applyBoardDrop(data) {
    if (!isMyTurn || !data) return

    if (data.type === 'rack') {
      handleRackTileDropOnBoard(data.tileId, null, undefined)
    } else if (data.type === 'boardTile') {
      handleBoardTileDrop(data.tileId, data.meldIdx, null, undefined)
    } else if (data.type === 'boardMeld') {
      handleTakeMeld(data.meldIdx)
    } else if (data.type === 'zoneTile') {
      const sourceZone = zones.find(z => z.id === data.zoneId)
      if (sourceZone) {
        const tile = sourceZone.tiles.find(t => t.id === data.tileId)
        if (tile) {
          removeTileFromZone(data.zoneId, data.tileId)
          createZone([tile])
        }
      }
    }

    setDropTarget(null)
    setDragTileId(null)
  }

  function onBoardDrop(e) {
    e.preventDefault()
    applyBoardDrop(parseDragData(e))
  }

  function applyZoneDrop(data, zoneId, insertAt) {
    if (!isMyTurn || !data) return

    if (data.type === 'rack') {
      handleRackTileDropOnBoard(data.tileId, zoneId, insertAt)
    } else if (data.type === 'boardTile') {
      handleBoardTileDrop(data.tileId, data.meldIdx, zoneId, insertAt)
    } else if (data.type === 'boardMeld') {
      const meld = board[data.meldIdx]
      if (meld) {
        affectMeld(data.meldIdx)
        addTilesToZone(zoneId, [...meld], insertAt)
      }
    } else if (data.type === 'zoneTile') {
      handleZoneTileDrop(data.tileId, data.zoneId, zoneId, insertAt)
    }

    setDropTarget(null)
    setDragTileId(null)
  }

  const onZoneDrop = useCallback((e, zoneId, insertAt) => {
    e.preventDefault(); e.stopPropagation()
    liveRef.current.applyZoneDrop(parseDragData(e), zoneId, insertAt)
  }, [])

  function applyMeldDrop(data, meldIdx) {
    if (!isMyTurn || !data) return

    if (data.type === 'rack') {
      handleBoardMeldDropOnMeld(data.tileId, meldIdx)
    } else if (data.type === 'boardTile') {
      handleBoardTileDropOnMeld(data.tileId, data.meldIdx, meldIdx)
    } else if (data.type === 'zoneTile') {
      handleZoneTileDropOnMeld(data.tileId, data.zoneId, meldIdx)
    }

    setDropTarget(null)
    setDragTileId(null)
  }

  const onMeldDrop = useCallback((e, meldIdx) => {
    e.preventDefault(); e.stopPropagation()
    liveRef.current.applyMeldDrop(parseDragData(e), meldIdx)
  }, [])

  const handleMeldDragOver = useCallback((e, meldIdx) => {
    setDropTarget(prev => {
      const next = `meld-${meldIdx}`
      return prev === next ? prev : next
    })
  }, [])

  function applyRackDrop(data) {
    if (!isMyTurn || !data) return

    if (data.type === 'zoneTile') {
      const tile = zones.find(z => z.id === data.zoneId)?.tiles.find(t => t.id === data.tileId)
      if (tile && handMap.has(tile.id)) {
        removeTileFromZone(data.zoneId, data.tileId)
        sound('place')
      }
    }

    setDropTarget(null)
    setDragTileId(null)
  }

  function onRackDrop(e) {
    e.preventDefault()
    applyRackDrop(parseDragData(e))
  }

  liveRef.current = { applyBoardDrop, applyZoneDrop, applyMeldDrop, applyRackDrop, onDragEnd }

  useEffect(() => {
    function resolveDropElement(x, y) {
      const el = document.elementFromPoint(x, y)
      return el?.closest('[data-drop-type]') ?? null
    }

    function setDropTargetIfChanged(next) {
      setDropTarget(prev => prev === next ? prev : next)
    }

    function flushTouchPreview() {
      touchRafIdRef.current = null
      if (pendingTouchPosRef.current) {
        setTouchPreviewPos(pendingTouchPosRef.current)
      }
    }

    function onTouchMove(e) {
      if (!touchDragRef.current) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - touchStartPosRef.current.x
      const dy = t.clientY - touchStartPosRef.current.y
      if (!touchActiveRef.current) {
        if (Math.hypot(dx, dy) < 8) return
        touchActiveRef.current = true
      }
      e.preventDefault()
      pendingTouchPosRef.current = { x: t.clientX, y: t.clientY }
      if (touchRafIdRef.current === null) {
        touchRafIdRef.current = requestAnimationFrame(flushTouchPreview)
      }

      const target = resolveDropElement(t.clientX, t.clientY)
      if (!target) { setDropTargetIfChanged(null); return }
      const type = target.dataset.dropType
      if (type === 'board') setDropTargetIfChanged('board')
      else if (type === 'meld') setDropTargetIfChanged(`meld-${target.dataset.meldIdx}`)
      else if (type === 'zone') setDropTargetIfChanged(`zone-${target.dataset.zoneId}`)
      else if (type === 'rack') setDropTargetIfChanged('rack')
    }

    function onTouchEnd(e) {
      if (!touchDragRef.current) return
      const { data } = touchDragRef.current
      const wasActive = touchActiveRef.current
      const t = e.changedTouches[0]
      const live = liveRef.current

      if (wasActive && t) {
        const target = resolveDropElement(t.clientX, t.clientY)
        if (target) {
          const type = target.dataset.dropType
          if (type === 'board') live.applyBoardDrop(data)
          else if (type === 'meld') live.applyMeldDrop(data, Number(target.dataset.meldIdx))
          else if (type === 'zone') live.applyZoneDrop(data, target.dataset.zoneId, Number(target.dataset.insertAt))
          else if (type === 'rack') live.applyRackDrop(data)
        }
      }

      touchDragRef.current = null
      touchActiveRef.current = false
      if (touchRafIdRef.current !== null) {
        cancelAnimationFrame(touchRafIdRef.current)
        touchRafIdRef.current = null
      }
      pendingTouchPosRef.current = null
      setTouchPreviewPos(null)
      live.onDragEnd()
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)
    return () => {
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      if (touchRafIdRef.current !== null) {
        cancelAnimationFrame(touchRafIdRef.current)
        touchRafIdRef.current = null
      }
    }
  }, [])

  const diffLabel = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' }[roomState?.difficulty] ?? ''
  const midpoint = Math.ceil(displayHand.length / 2)
  const row1 = displayHand.slice(0, midpoint)
  const row2 = displayHand.slice(midpoint)

  return (
    <div className="game-root">

      {/* ── SVG defs for icon gradients ──────────────────────────────── */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="icon-grad-white" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
          </linearGradient>
          <linearGradient id="icon-grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
          <linearGradient id="icon-grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="icon-grad-amber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="icon-grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <span className="font-heading text-neon" style={{ color: '#A78BFA', fontSize: '1rem' }}>RUMMIKUB</span>
          <span style={{ fontSize: 11, color: '#64748B' }}>
            Sala <span style={{ color: '#FCD34D', fontWeight: 700 }}>{roomState?.code}</span>
          </span>
          <span style={{ fontSize: 11, color: '#64748B' }}>Mazo: <span style={{ color: roomState?.deckCount === 0 ? '#F87171' : 'white' }}>{roomState?.deckCount ?? 0}</span></span>
          {roomState?.deckCount === 0 && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              Pozo agotado
            </span>
          )}
          {diffLabel && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 999,
              background: { easy: 'rgba(34,197,94,0.15)', medium: 'rgba(234,179,8,0.15)', hard: 'rgba(239,68,68,0.15)' }[roomState?.difficulty],
              color: { easy: '#4ADE80', medium: '#FDE047', hard: '#F87171' }[roomState?.difficulty],
              border: `1px solid ${{ easy: 'rgba(34,197,94,0.3)', medium: 'rgba(234,179,8,0.3)', hard: 'rgba(239,68,68,0.3)' }[roomState?.difficulty]}`,
            }}>
              {diffLabel} · {totalSecs}s
            </span>
          )}
        </div>
        <motion.div
          animate={turnFlash ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: isMyTurn ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
            color: isMyTurn ? '#4ADE80' : '#94A3B8',
            border: `1px solid ${isMyTurn ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
          }}>
          {isMyTurn ? '¡Tu turno!' : `Turno: ${currentPlayer?.name ?? '...'}`}
        </motion.div>
      </div>

      {/* ── TURN-CHANGE FLASH ──────────────────────────────────────────── */}
      <AnimatePresence>
        {turnFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(74,222,128,0.5)',
              pointerEvents: 'none', zIndex: 50,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── PLAYERS ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, padding: '10px 16px 8px', background: 'rgba(0,0,0,0.2)', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {roomState?.players?.map(p => (
          <PlayerAvatar
            key={p.id}
            player={p}
            isCurrent={p.id === roomState?.currentPlayerId}
            isMe={p.id === socketId}
            left={p.id === roomState?.currentPlayerId ? timeLeft : totalSecs}
            total={totalSecs}
          />
        ))}
      </div>

      {/* ── BOARD ───────────────────────────────────────────────────────── */}
      <div
        className="board-area"
        style={{ flex: 1, overflow: 'auto', position: 'relative', padding: 16 }}
        data-drop-type="board"
        onDragOver={(e) => { e.preventDefault(); if (dropTarget !== 'board') setDropTarget('board') }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null) }}
        onDrop={onBoardDrop}
      >
        <div style={{
          position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)',
          fontFamily: 'Russo One', pointerEvents: 'none', userSelect: 'none', textAlign: 'center', zIndex: 0
        }}>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.06)', letterSpacing: '0.2em', marginBottom: 4 }}>The Original</div>
          <div style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.05)', letterSpacing: '0.05em' }}>Rummikub</div>
        </div>

        <AnimatePresence>
          {localError && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'sticky', top: 0, zIndex: 20, marginBottom: 10,
                background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 10, padding: '8px 14px', color: '#FCA5A5',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem'
              }}>
              {localError}
              <button onClick={() => setLocalError(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', marginLeft: 8, fontSize: '1rem' }}>✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {board.length === 0 && zones.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
              El tablero está vacío — arrastra fichas para jugar
            </div>
          )}

          <motion.div layout className="flex flex-wrap gap-3">
            <AnimatePresence>
              {visibleBoard.map(({ meld, i, key }) => (
                <BoardMeld
                  key={key}
                  meld={meld}
                  originalIdx={i}
                  isDropTarget={dropTarget === `meld-${i}`}
                  draggingTileId={dragTileId}
                  canInteract={canInteractWithBoard && !me?.hasInitialMeld ? false : canInteractWithBoard}
                  onTileDragStart={onBoardTileDragStart}
                  onMeldDragStart={onBoardMeldDragStart}
                  onMeldDragEnd={onDragEnd}
                  onDrop={onMeldDrop}
                  onDragOverMeld={handleMeldDragOver}
                  onTileTouchStart={onBoardTileTouchStart}
                  onMeldTouchStart={onBoardMeldTouchStart}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {zones.length > 0 && (
            <motion.div layout className="flex flex-wrap gap-3 mt-3">
            <AnimatePresence>
              {zones.map(zone => (
                <Zone
                  key={zone.id}
                  zone={zone}
                  canInteract={isMyTurn}
                  isDropTarget={dropTarget === `zone-${zone.id}`}
                  dragTileId={dragTileId}
                  onZoneDrop={onZoneDrop}
                  onTileDragStart={onZoneTileDragStart}
                  onTileDragEnd={onDragEnd}
                   onDoubleClickTile={handleDoubleClickZoneTile}
                  fromBoard={allZoneBoardTileIds}
                  onTileTouchStart={onZoneTileTouchStart}
                />
              ))}
            </AnimatePresence>
            </motion.div>
          )}

          <AnimatePresence>
            {opponentDraft && opponentDraft.zones.length > 0 && (
              <motion.div
                className="mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  {roomState?.players?.find(p => p.id === opponentDraft.playerId)?.name ?? 'Oponente'} está reorganizando...
                </div>
                <div className="flex flex-wrap gap-3 opacity-60 pointer-events-none">
                  {opponentDraft.zones.map(zone => (
                    <div key={zone.id} className="flex gap-1 p-2 rounded-xl border border-yellow-500/30 bg-yellow-900/10">
                      {zone.tiles.map(tile => (
                        <CreamTile key={tile.id} tile={tile} className="board-ctile" />
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isMyTurn && !me?.hasInitialMeld && (
            <div
              className={`flex items-center justify-center min-h-16 mt-3 p-4 rounded-2xl border-2 border-dashed transition-all duration-150
                ${dropTarget === 'board' ? 'staging-drop-active' : 'border-white/15 bg-white/3'}`}
              data-drop-type="board"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dropTarget !== 'board') setDropTarget('board') }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onBoardDrop(e) }}
            >
              {zones.length === 0 && (
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', textAlign: 'center' }}>
                  Arrastra fichas aquí para crear una nueva zona
                </span>
              )}
              {zones.length > 0 && (
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', textAlign: 'center' }}>
                  + Arrastra fichas para nueva zona
                </span>
              )}
            </div>
          )}

          {!me?.hasInitialMeld && hasChanges && (
            <div style={{ marginTop: 8, fontSize: 11, color: meetsInitialMeld ? '#4ADE80' : '#F87171', textAlign: 'center' }}>
              {meetsInitialMeld
                ? `✓ Primera bajada: ${initialMeldHandScore} pts (≥30)`
                : `Primera bajada: ${initialMeldHandScore} pts — necesitas ≥30 pts de tu mano`}
            </div>
          )}
        </div>
      </div>

      {/* ── RACK ────────────────────────────────────────────────────────── */}
      <div
        className={`rack-tray ${dropTarget === 'rack' ? 'rack-drop-active' : ''}`}
        style={{ flexShrink: 0, padding: '10px 12px 12px' }}
        data-drop-type="rack"
        onDragOver={(e) => { if (dragFrom.current === 'zoneTile') { e.preventDefault(); setDropTarget('rack') } }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={onRackDrop}
      >
        <div className="flex items-stretch gap-3">

            <div className="flex flex-col gap-1 shrink-0" style={{ width: 56 }}>
            <motion.button
              onClick={() => setSortBy(s => s === 'number' ? null : 'number')}
              whileHover={HOVER}
              whileTap={TAP}
              title="Ordenar por número"
              className="rack-btn rack-btn-onyx flex-1 flex items-center justify-center"
              style={{
                outline: sortBy === 'number' ? '2px solid rgba(212,175,55,0.65)' : '2px solid rgba(255,255,255,0.12)',
                boxShadow: sortBy === 'number'
                  ? '0 2px 8px rgba(0,0,0,0.5), 0 0 16px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : '0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
              }}
            >
              <span className="rack-btn-label font-heading" style={{ fontSize: '1rem' }}>777</span>
            </motion.button>
            <motion.button
              onClick={() => setSortBy(s => s === 'color' ? null : 'color')}
              whileHover={HOVER}
              whileTap={TAP}
              title="Ordenar por color"
              className="rack-btn rack-btn-onyx flex-1 flex items-center justify-center"
              style={{
                outline: sortBy === 'color' ? '2px solid rgba(212,175,55,0.65)' : '2px solid rgba(255,255,255,0.12)',
                boxShadow: sortBy === 'color'
                  ? '0 2px 8px rgba(0,0,0,0.5), 0 0 16px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : '0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
              }}
            >
              <span className="rack-btn-label font-heading" style={{ fontSize: '1rem' }}>789</span>
            </motion.button>
          </div>

          <div className="flex-1 flex flex-col gap-1 items-center">
            {[row1, row2].map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1 flex-nowrap justify-center">
                {row.map(tile => {
                  const inPlay = zoneTileIds.has(tile.id)
                  const dragging = dragTileId === tile.id
                  const isDrawn = tile.id === drawnTileId
                  const nc = tile.isJoker ? '#ffffff' : NUM_COLOR[tile.color] ?? '#111'
                  return (
                    <div
                      key={tile.id}
                      draggable={isMyTurn && !inPlay}
                      onDragStart={(e) => onRackDragStart(e, tile)}
                      onDragEnd={onDragEnd}
                      onTouchStart={isMyTurn && !inPlay ? (e) => onRackTouchStart(e, tile) : undefined}
                      className={`ctile rack-ctile
                        ${inPlay ? 'rack-ctile-staged' : ''}
                        ${!isMyTurn || inPlay ? 'rack-ctile-disabled' : ''}
                        ${dragging ? 'rack-ctile-dragging' : ''}
                        ${tile.isJoker ? 'ctile-joker' : ''}
                        ${isDrawn && !inPlay ? 'rack-ctile-drawn' : ''}
                      `}
                      style={{ color: inPlay ? 'transparent' : nc, touchAction: isMyTurn && !inPlay ? 'none' : 'auto' }}
                      title={tile.isJoker ? 'Comodín' : `${tile.number} ${tile.color}`}
                    >
                      {inPlay ? '' : tile.isJoker ? '★' : tile.number}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="flex gap-1 shrink-0 items-stretch">
            <motion.button
              onClick={isMyTurn && handTileIdsInZones.size === 0 ? drawTile : undefined}
              disabled={!isMyTurn || handTileIdsInZones.size > 0}
              whileHover={isMyTurn && handTileIdsInZones.size === 0 ? HOVER : {}}
              whileTap={isMyTurn && handTileIdsInZones.size === 0 ? TAP : {}}
              title={
                handTileIdsInZones.size > 0
                  ? 'Debes confirmar o cancelar tu jugada antes de robar'
                  : roomState?.deckCount === 0 ? 'Pozo agotado — pasar turno' : 'Robar ficha'
              }
              className={`rack-btn ${isMyTurn && handTileIdsInZones.size === 0 && roomState?.deckCount !== 0 ? 'rack-btn-draw' : ''}`}
              style={{
                width: 56,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 0',
                ...(isMyTurn && handTileIdsInZones.size === 0 && roomState?.deckCount === 0
                  ? { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }
                  : {}),
              }}
            >
              {roomState?.deckCount === 0 ? (
                <svg className="rack-btn-icon" viewBox="0 0 24 24" fill="none" stroke={isMyTurn && handTileIdsInZones.size === 0 ? 'url(#icon-grad-red)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              ) : (
                <svg className="rack-btn-icon" viewBox="0 0 24 24" fill="none" stroke={isMyTurn && handTileIdsInZones.size === 0 ? 'url(#icon-grad-blue)' : 'rgba(255,255,255,0.2)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="4" />
                  <line x1="12" y1="7" x2="12" y2="17" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </svg>
              )}
              <span className="font-heading" style={{ color: isMyTurn && handTileIdsInZones.size === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>
                {roomState?.deckCount ?? 0}
              </span>
            </motion.button>
            <div className="flex flex-col gap-1" style={{ width: 56 }}>
              <motion.button
                onClick={canFinalizeTurn ? () => handleEndTurn(false) : undefined}
                whileHover={canFinalizeTurn ? HOVER : {}}
                whileTap={canFinalizeTurn ? TAP : {}}
                title="Finalizar jugada"
                className={`rack-btn flex-1 flex items-center justify-center ${canFinalizeTurn ? 'rack-btn-active' : ''}`}
                style={{
                  ...(canFinalizeTurn ? {} : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.04)' }),
                }}
              >
                <svg className="rack-btn-icon" viewBox="0 0 24 24" fill="none" stroke={canFinalizeTurn ? 'url(#icon-grad-green)' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8,12 11,15 16,9" />
                </svg>
              </motion.button>
              <motion.button
                onClick={isMyTurn && zones.length > 0 ? handleUndo : undefined}
                whileHover={isMyTurn && zones.length > 0 ? HOVER : {}}
                whileTap={isMyTurn && zones.length > 0 ? TAP : {}}
                title="Deshacer última ficha"
                className={`rack-btn flex-1 flex items-center justify-center ${isMyTurn && zones.length > 0 ? 'rack-btn-undo' : ''}`}
                style={{
                  ...(isMyTurn && zones.length > 0 ? {} : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.04)' }),
                }}
              >
                <svg className="rack-btn-icon" viewBox="0 0 24 24" fill="none" stroke={isMyTurn && zones.length > 0 ? 'url(#icon-grad-amber)' : 'rgba(255,255,255,0.2)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 7 3 13 9 13" />
                  <path d="M21 17a9 9 0 0 0-15-6.72L3 13" />
                </svg>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {touchPreviewPos && touchDragRef.current?.tile && createPortal(
        <div
          style={{
            position: 'fixed',
            left: touchPreviewPos.x,
            top: touchPreviewPos.y - 60,
            transform: 'translate(-50%, -50%) scale(1.15)',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.92,
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
          }}
        >
          <CreamTile tile={touchDragRef.current.tile} className="board-ctile" />
        </div>,
        document.body
      )}
    </div>
  )
}
