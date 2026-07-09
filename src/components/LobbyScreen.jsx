import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import socket from '../socket.js'
import { fadeSlideUp, staggerContainer, TAP, HOVER } from '../motion.js'

const DIFFICULTIES = [
  { id: 'easy',   label: 'Fácil',   seconds: 120, color: 'text-green-400',  ring: 'ring-green-500', bg: 'bg-green-500/20 border-green-500/40' },
  { id: 'medium', label: 'Medio',   seconds: 90,  color: 'text-yellow-400', ring: 'ring-yellow-500', bg: 'bg-yellow-500/20 border-yellow-500/40' },
  { id: 'hard',   label: 'Difícil', seconds: 40,  color: 'text-rose-400',   ring: 'ring-rose-500',   bg: 'bg-rose-500/20 border-rose-500/40' },
]

export default function LobbyScreen({ roomState, playerInfo, socketId, onLeave, error }) {
  const [difficulty, setDifficulty] = useState('easy')
  const [copied, setCopied] = useState(false)
  const isHost = roomState?.hostId === socketId
  const playerCount = roomState?.players?.length ?? 0
  const canStart = isHost && playerCount >= 2
  const code = roomState?.code ?? playerInfo?.code ?? '...'

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <motion.div className="w-full max-w-md space-y-4" variants={staggerContainer} initial="hidden" animate="visible">

        <motion.div variants={fadeSlideUp} className="text-center">
          <h1 className="font-heading text-4xl text-neon text-purple-300">SALA DE ESPERA</h1>
        </motion.div>

        {/* Room code */}
        <motion.div variants={fadeSlideUp} className="glass-panel p-5 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Código de Sala</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-heading text-5xl text-yellow-400 tracking-widest">{code}</span>
            <motion.button
              onClick={copyCode}
              whileTap={{ scale: 0.85 }}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Copiar código"
              aria-label="Copiar código"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.svg
                    key="check"
                    xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="copy"
                    xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
          <p className="text-slate-500 text-xs mt-2">{copied ? 'Copiado ✓' : 'Comparte este código con tus amigos'}</p>
        </motion.div>

        {/* Players */}
        <motion.div variants={fadeSlideUp} className="glass-panel p-5">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Jugadores ({playerCount}/4)</p>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {roomState?.players?.map(p => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className={`flex items-center gap-3 p-3 rounded-xl
                    ${p.id === socketId ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-white/5'}`}
                >
                  {p.avatar?.url
                    ? <img src={p.avatar.url} alt="" className="w-10 h-10 rounded-full" />
                    : <span className="text-3xl">👤</span>}
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">
                      {p.name}
                      {p.id === socketId && <span className="text-purple-400 text-xs ml-2">(tú)</span>}
                    </p>
                  </div>
                  {p.id === roomState?.hostId && (
                    <span className="text-yellow-400 text-xs font-semibold px-2 py-0.5 bg-yellow-400/10 rounded-full border border-yellow-400/30">
                      Host
                    </span>
                  )}
                </motion.div>
              ))}
              {Array.from({ length: Math.max(0, 4 - playerCount) }).map((_, i) => (
                <motion.div
                  key={`empty-${i}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-dashed border-white/10"
                >
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 text-sm">Esperando jugador...</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Difficulty selector — host only */}
        {isHost && (
          <motion.div variants={fadeSlideUp} className="glass-panel p-5">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">
              Dificultad · Temporizador de Turno
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map(d => {
                const sel = difficulty === d.id
                return (
                  <motion.button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    animate={{ scale: sel ? 1.05 : 1 }}
                    className={`flex flex-col items-center py-3 px-2 rounded-xl border cursor-pointer
                      ${sel ? `${d.bg} ring-2 ${d.ring}` : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    <span className={`font-heading text-lg ${sel ? d.color : 'text-slate-300'}`}>{d.label}</span>
                    <span className={`text-xs mt-0.5 ${sel ? d.color : 'text-slate-500'}`}>{d.seconds}s / turno</span>
                  </motion.button>
                )
              })}
            </div>
            {!isHost && (
              <p className="text-slate-600 text-xs mt-2 text-center">Solo el host elige la dificultad</p>
            )}
          </motion.div>
        )}

        {/* Non-host: show selected difficulty (read-only) */}
        {!isHost && (
          <motion.div variants={fadeSlideUp} className="glass-panel p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-widest">Dificultad elegida por el host</p>
            <p className="text-slate-300 text-sm mt-1">Se mostrará al iniciar el juego</p>
          </motion.div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-rose-600/20 border border-rose-500/40 rounded-xl px-4 py-3 text-rose-300 text-sm overflow-hidden"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <motion.div variants={fadeSlideUp} className="space-y-2">
          {isHost ? (
            <>
              <motion.button
                onClick={() => socket.emit('start-game', { difficulty })}
                disabled={!canStart}
                whileHover={canStart ? HOVER : {}}
                whileTap={canStart ? TAP : {}}
                className="btn-primary w-full py-3 text-base"
              >
                {canStart ? 'Iniciar Juego' : `Esperando jugadores (${playerCount}/2 mín.)`}
              </motion.button>
              {!canStart && (
                <p className="text-center text-slate-500 text-xs">Necesitas al menos 2 jugadores</p>
              )}
            </>
          ) : (
            <div className="glass-panel p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-sm">Esperando que el host inicie el juego...</span>
              </div>
            </div>
          )}
          <motion.button
            onClick={onLeave}
            whileHover={HOVER}
            whileTap={TAP}
            className="btn-secondary w-full py-2 text-sm"
          >
            Salir de la Sala
          </motion.button>
        </motion.div>

        <p className="text-center text-slate-600 text-xs">2-4 jugadores por partida</p>
      </motion.div>
    </div>
  )
}
