import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { fadeSlideUp, staggerContainer, TAP, HOVER } from '../motion.js'

const SPARK_COLORS = ['#FCD34D', '#A78BFA', '#FFFFFF']

function WinnerSparks() {
  const sparks = useMemo(() => (
    Array.from({ length: 14 }).map((_, i) => {
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4
      const dist = 90 + Math.random() * 60
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        color: SPARK_COLORS[i % SPARK_COLORS.length],
        delay: 0.1 + Math.random() * 0.2,
      }
    })
  ), [])

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      {sparks.map(s => (
        <motion.div
          key={s.id}
          className="absolute w-2 h-2 rounded-full"
          style={{ backgroundColor: s.color, top: '30%' }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: s.x, y: s.y, opacity: [1, 1, 0], scale: [0, 1, 0.5] }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: s.delay }}
        />
      ))}
    </div>
  )
}

export default function EndScreen({ roomState, socketId, onPlayAgain, onLeave }) {
  const isHost = roomState?.hostId === socketId
  const winner = roomState?.players?.find(p => p.id === roomState?.winner)
  const isWinner = roomState?.winner === socketId

  const sorted = [...(roomState?.players ?? [])].sort((a, b) => a.score - b.score)

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md space-y-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >

        {/* Winner banner */}
        <motion.div variants={fadeSlideUp} className="relative glass-panel p-8 text-center overflow-hidden">
          {isWinner && <WinnerSparks />}
          <motion.div
            className="text-6xl mb-3 relative"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.1 }}
          >
            {winner?.avatar?.url
              ? <img src={winner.avatar.url} alt="" className="w-20 h-20 mx-auto" />
              : '🏆'}
          </motion.div>
          {isWinner ? (
            <>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-heading text-4xl text-yellow-400 text-neon mb-1 animate-glow"
              >
                ¡GANASTE!
              </motion.h1>
              <p className="text-slate-300">¡Felicitaciones, {winner?.name}!</p>
            </>
          ) : (
            <>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-heading text-3xl text-purple-300 mb-1"
              >
                Fin del Juego
              </motion.h1>
              <p className="text-slate-300">
                <span className="text-yellow-400 font-semibold">{winner?.name}</span> ganó la partida
              </p>
            </>
          )}
        </motion.div>

        {/* Scores */}
        <motion.div variants={fadeSlideUp} className="glass-panel p-5">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Puntuaciones Finales</p>
          <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="visible">
            {sorted.map((p, i) => {
              const isW = p.id === roomState?.winner
              return (
                <motion.div
                  key={p.id}
                  variants={fadeSlideUp}
                  className={`flex items-center gap-3 p-3 rounded-xl
                    ${isW ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-white/5'}`}
                >
                  <span className="text-slate-400 font-heading w-5 text-center">{i + 1}</span>
                  {p.avatar?.url
                    ? <img src={p.avatar.url} alt="" className="w-8 h-8" />
                    : <span className="text-2xl">👤</span>}
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">
                      {p.name}
                      {p.id === socketId && <span className="text-blue-400 text-xs ml-1">(tú)</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-heading text-lg ${isW ? 'text-yellow-400' : 'text-white'}`}>
                      {isW ? '🏆' : `${p.score} pts`}
                    </p>
                    {!isW && p.score > 0 && (
                      <p className="text-slate-500 text-xs">{p.handCount} fichas</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
          <p className="text-slate-600 text-xs mt-3 text-center">
            Puntuación = valor de fichas restantes en mano
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div variants={fadeSlideUp} className="space-y-2">
          {isHost ? (
            <motion.button
              onClick={onPlayAgain}
              whileHover={HOVER}
              whileTap={TAP}
              className="btn-primary w-full py-3 text-base"
            >
              Jugar de Nuevo
            </motion.button>
          ) : (
            <div className="glass-panel p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-sm">Esperando que el host reinicie...</span>
              </div>
            </div>
          )}
          <motion.button
            onClick={onLeave}
            whileHover={HOVER}
            whileTap={TAP}
            className="btn-secondary w-full py-2 text-sm"
          >
            Salir al Menú
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  )
}
