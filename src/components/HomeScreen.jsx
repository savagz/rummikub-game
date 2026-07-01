import { useState } from 'react'

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
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-5xl text-neon text-purple-300 mb-1">RUMMIKUB</h1>
          <p className="text-slate-400 text-sm tracking-widest">MULTIJUGADOR</p>
        </div>

        <div className="glass-panel p-6 space-y-6">

          {/* Avatar selection */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Elige tu Avatar</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map(av => (
                <button
                  key={av.id}
                  onClick={() => { setAvatar(av); clearError() }}
                  className={`
                    flex items-center justify-center py-3 px-1 rounded-xl text-2xl transition-all duration-150 cursor-pointer
                    ${avatar?.id === av.id
                      ? 'bg-purple-600/60 ring-2 ring-purple-400 scale-110'
                      : 'bg-white/5 hover:bg-white/15'}
                  `}
                >
                  <img src={av.url} alt="" className="w-10 h-10" />
                </button>
              ))}
            </div>
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
          {error && (
            <div className="bg-rose-600/20 border border-rose-500/40 rounded-xl px-4 py-3 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Action buttons */}
          {!mode && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setMode('create'); clearError() }}
                disabled={!canProceed}
                className="btn-primary py-3 text-sm"
              >
                Crear Sala
              </button>
              <button
                onClick={() => { setMode('join'); clearError() }}
                disabled={!canProceed}
                className="btn-secondary py-3 text-sm"
              >
                Unirse a Sala
              </button>
            </div>
          )}

          {/* Create mode */}
          {mode === 'create' && (
            <div className="space-y-3">
              <button onClick={handleCreate} className="btn-primary w-full py-3">
                Crear Sala Nueva
              </button>
              <button onClick={() => { setMode(null); clearError() }} className="btn-secondary w-full py-2 text-sm">
                Volver
              </button>
            </div>
          )}

          {/* Join mode */}
          {mode === 'join' && (
            <div className="space-y-3">
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
              <button
                onClick={handleJoin}
                disabled={roomCode.length < 4}
                className="btn-primary w-full py-3"
              >
                Unirse
              </button>
              <button onClick={() => { setMode(null); clearError() }} className="btn-secondary w-full py-2 text-sm">
                Volver
              </button>
            </div>
          )}

          {/* Hint */}
          {!mode && !canProceed && (
            <p className="text-center text-slate-500 text-xs">
              {!avatar ? 'Selecciona un avatar' : 'Escribe tu nombre (mín. 2 caracteres)'}
            </p>
          )}
        </div>

        {/* Rules reminder */}
        <div className="mt-4 glass-panel p-4 text-slate-500 text-xs space-y-1">
          <p className="text-slate-300 font-semibold text-sm mb-2">Reglas Básicas</p>
          <p>Primer meld debe sumar <span className="text-purple-300">≥30 puntos</span></p>
          <p>Grupos: mismo número, colores distintos (3-4 fichas)</p>
          <p>Escaleras: mismo color, números consecutivos (3+ fichas)</p>
          <p>Gana quien vacíe su mano primero</p>
        </div>
      </div>
    </div>
  )
}
