export default function EndScreen({ roomState, socketId, onPlayAgain, onLeave }) {
  const isHost = roomState?.hostId === socketId
  const winner = roomState?.players?.find(p => p.id === roomState?.winner)
  const isWinner = roomState?.winner === socketId

  const sorted = [...(roomState?.players ?? [])].sort((a, b) => a.score - b.score)

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Winner banner */}
        <div className="glass-panel p-8 text-center">
          <div className="text-6xl mb-3">
            {winner?.avatar?.url
              ? <img src={winner.avatar.url} alt="" className="w-20 h-20 mx-auto" />
              : '🏆'}
          </div>
          {isWinner ? (
            <>
              <h1 className="font-heading text-4xl text-yellow-400 text-neon mb-1">¡GANASTE!</h1>
              <p className="text-slate-300">¡Felicitaciones, {winner?.name}!</p>
            </>
          ) : (
            <>
              <h1 className="font-heading text-3xl text-purple-300 mb-1">Fin del Juego</h1>
              <p className="text-slate-300">
                <span className="text-yellow-400 font-semibold">{winner?.name}</span> ganó la partida
              </p>
            </>
          )}
        </div>

        {/* Scores */}
        <div className="glass-panel p-5">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Puntuaciones Finales</p>
          <div className="space-y-2">
            {sorted.map((p, i) => {
              const isW = p.id === roomState?.winner
              return (
                <div
                  key={p.id}
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
                </div>
              )
            })}
          </div>
          <p className="text-slate-600 text-xs mt-3 text-center">
            Puntuación = valor de fichas restantes en mano
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {isHost ? (
            <button onClick={onPlayAgain} className="btn-primary w-full py-3 text-base">
              Jugar de Nuevo
            </button>
          ) : (
            <div className="glass-panel p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-sm">Esperando que el host reinicie...</span>
              </div>
            </div>
          )}
          <button onClick={onLeave} className="btn-secondary w-full py-2 text-sm">
            Salir al Menú
          </button>
        </div>
      </div>
    </div>
  )
}
