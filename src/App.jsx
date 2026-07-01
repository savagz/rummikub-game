import { useState, useEffect } from 'react'
import socket from './socket.js'
import HomeScreen from './components/HomeScreen.jsx'
import LobbyScreen from './components/LobbyScreen.jsx'
import GameScreen from './components/GameScreen.jsx'
import EndScreen from './components/EndScreen.jsx'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [roomState, setRoomState] = useState(null)
  const [playerInfo, setPlayerInfo] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    socket.connect()

    socket.on('room-updated', (state) => {
      setRoomState(state)
      setError(null)
      if (state.status === 'playing') {
        setScreen('game')
      } else if (state.status === 'ended') {
        setScreen('end')
      } else {
        setScreen(s => s === 'home' ? s : 'lobby')
      }
    })

    socket.on('error', ({ message }) => {
      setError(message)
    })

    return () => {
      socket.off('room-updated')
      socket.off('error')
    }
  }, [])

  function handleCreateRoom({ name, avatar }) {
    setPlayerInfo({ name, avatar })
    socket.emit('create-room', { name, avatar })
    setScreen('lobby')
  }

  function handleJoinRoom({ code, name, avatar }) {
    setPlayerInfo({ name, avatar, code })
    socket.emit('join-room', { code, name, avatar })
    setScreen('lobby')
  }

  function handleLeaveRoom() {
    socket.emit('leave-room')
    setRoomState(null)
    setPlayerInfo(null)
    setError(null)
    setScreen('home')
  }

  if (screen === 'home') {
    return (
      <HomeScreen
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        error={error}
        clearError={() => setError(null)}
      />
    )
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen
        roomState={roomState}
        playerInfo={playerInfo}
        socketId={socket.id}
        onLeave={handleLeaveRoom}
        error={error}
        clearError={() => setError(null)}
      />
    )
  }

  if (screen === 'game') {
    return (
      <GameScreen
        roomState={roomState}
        socketId={socket.id}
        error={error}
        clearError={() => setError(null)}
      />
    )
  }

  if (screen === 'end') {
    return (
      <EndScreen
        roomState={roomState}
        socketId={socket.id}
        onPlayAgain={() => socket.emit('play-again')}
        onLeave={handleLeaveRoom}
      />
    )
  }

  return null
}
