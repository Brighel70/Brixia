import React from 'react'
import { Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">Brixia Rugby</h1>
        <p className="text-gray-600">App caricata con successo!</p>
        <Outlet />
      </div>
    </div>
  )
}