import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeSlideUp, staggerContainer, TAP, HOVER } from '../motion.js'

const AVATARS = [
  { id: 'f1', url: '/Avatar_1.png' },
  { id: 'f2', url: '/Avatar_2.png' },
  { id: 'f3', url: '/Avatar_3.png' },
  { id: 'f4', url: '/Avatar_4.png' },
  { id: 'f5', url: '/Avatar_5.png' },
  { id: 'f6', url: '/Avatar_6.png' },
  { id: 'm1', url: '/Avatar_7.png' },
  { id: 'm2', url: '/Avatar_8.png' },
  { id: 'm3', url: '/Avatar_9.png' },
  { id: 'm4', url: '/Avatar_10.png' },
  { id: 'm5', url: '/Avatar_11.png' },
  { id: 'm6', url: '/Avatar_12.png' },
]

const avatarStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.02 } },
}
const avatarItem = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
}

export default function HomeScreen({ onCreateRoom, onJoinRoom, error, clearError }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [roomCode, setRoomCode] = useState('')

  const canProceed = name.trim().length >= 2 && avatar !== null

  function handleCreate() {
    if (!canProceed) return
    onCreateRoom({ name: name.trim(), avatar })
  }

  function handleJoin() {
    if (!canProceed || roomCode.trim().length < 4) return
    onJoinRoom({ code: roomCode.trim().toUpperCase(), name: name.trim(), avatar })
  }

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <motion.div className="w-full max-w-lg" variants={staggerContainer} initial="hidden" animate="visible">

        {/* Header */}
        <motion.div variants={fadeSlideUp} className="text-center mb-8">
          <h1 className="font-heading text-5xl text-neon text-purple-300 mb-1">RUMMIKUB</h1>
          <p className="text-slate-400 text-sm tracking-widest">MULTIJUGADOR</p>
        </motion.div>

        <motion.div variants={fadeSlideUp} layout className="glass-panel p-6 space-y-6">

          {/* Avatar selection */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Elige tu Avatar</p>
            <motion.div
              className="grid grid-cols-6 gap-2"
              variants={avatarStagger}
              initial="hidden"
              animate="visible"
            >
              {AVATARS.map(av => {
                const selected = avatar?.id === av.id
                return (
                  <motion.button
                    key={av.id}
                    variants={avatarItem}
                    onClick={() => { setAvatar(av); clearError() }}
                    whileHover={{ scale: selected ? 1.1 : 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    animate={{ scale: selected ? 1.1 : 1 }}
                    className={`
                      flex items-center justify-center py-3 px-1 rounded-xl text-2xl cursor-pointer
                      ${selected
                        ? 'bg-purple-600/60 ring-2 ring-purple-400'
                        : 'bg-white/5 hover:bg-white/15'}
                    `}
                  >
                    <img src={av.url} alt="" className="w-10 h-10" />
                  </motion.button>
                )
              })}
            </motion.div>
          </div>

          {/* Name input */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Tu Nombre</p>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); clearError() }}
              placeholder="Ej. Jugador1"
              maxLength={16}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

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

          {/* Action buttons */}
          <AnimatePresence mode="wait">
            {!mode && (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 gap-3"
              >
                <motion.button
                  onClick={() => { setMode('create'); clearError() }}
                  disabled={!canProceed}
                  whileHover={canProceed ? HOVER : {}}
                  whileTap={canProceed ? TAP : {}}
                  className="btn-primary py-3 text-sm"
                >
                  Crear Sala
                </motion.button>
                <motion.button
                  onClick={() => { setMode('join'); clearError() }}
                  disabled={!canProceed}
                  whileHover={canProceed ? HOVER : {}}
                  whileTap={canProceed ? TAP : {}}
                  className="btn-secondary py-3 text-sm"
                >
                  Unirse a Sala
                </motion.button>
              </motion.div>
            )}

            {/* Create mode */}
            {mode === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                <motion.button onClick={handleCreate} whileHover={HOVER} whileTap={TAP} className="btn-primary w-full py-3">
                  Crear Sala Nueva
                </motion.button>
                <motion.button
                  onClick={() => { setMode(null); clearError() }}
                  whileHover={HOVER}
                  whileTap={TAP}
                  className="btn-secondary w-full py-2 text-sm"
                >
                  Volver
                </motion.button>
              </motion.div>
            )}

            {/* Join mode */}
            {mode === 'join' && (
              <motion.div
                key="join"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Código de Sala</p>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => { setRoomCode(e.target.value.toUpperCase()); clearError() }}
                    placeholder="ABCD"
                    maxLength={4}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center
                      text-2xl font-heading tracking-widest placeholder-slate-600
                      focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all uppercase"
                  />
                </div>
                <motion.button
                  onClick={handleJoin}
                  disabled={roomCode.length < 4}
                  whileHover={roomCode.length >= 4 ? HOVER : {}}
                  whileTap={roomCode.length >= 4 ? TAP : {}}
                  className="btn-primary w-full py-3"
                >
                  Unirse
                </motion.button>
                <motion.button
                  onClick={() => { setMode(null); clearError() }}
                  whileHover={HOVER}
                  whileTap={TAP}
                  className="btn-secondary w-full py-2 text-sm"
                >
                  Volver
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint */}
          {!mode && !canProceed && (
            <p className="text-center text-slate-500 text-xs">
              {!avatar ? 'Selecciona un avatar' : 'Escribe tu nombre (mín. 2 caracteres)'}
            </p>
          )}
        </motion.div>

        {/* Rules reminder */}
        <motion.div variants={fadeSlideUp} className="mt-4 glass-panel p-4 text-slate-500 text-xs space-y-1">
          <p className="text-slate-300 font-semibold text-sm mb-2">Reglas Básicas</p>
          <p>Primer meld debe sumar <span className="text-purple-300">≥30 puntos</span></p>
          <p>Grupos: mismo número, colores distintos (3-4 fichas)</p>
          <p>Escaleras: mismo color, números consecutivos (3+ fichas)</p>
          <p>Gana quien vacíe su mano primero</p>
        </motion.div>
      </motion.div>
    </div>
  )
}
