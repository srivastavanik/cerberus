'use client'

import { useState } from 'react'
import LayoutWrapper from '../../components/layout-wrapper'
import { supabase } from '../../lib/supabase'

export default function Simulation() {
  const [isRunning, setIsRunning] = useState(false)
  const [vehicleCount, setVehicleCount] = useState(50)
  const [duration, setDuration] = useState(60)
  const [scenario, setScenario] = useState('normal')
  const [logs, setLogs] = useState<string[]>([])

  const startSimulation = async () => {
    setIsRunning(true)
    setLogs(['Starting simulation...'])
    
    try {
      // In a real implementation, this would trigger the backend simulation
      const response = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleCount,
          duration,
          scenario
        })
      })
      
      if (response.ok) {
        setLogs(prev => [...prev, `Simulation started with ${vehicleCount} vehicles`])
        setLogs(prev => [...prev, `Running ${scenario} scenario for ${duration} seconds`])
        
        // Simulate progress updates
        for (let i = 1; i <= 5; i++) {
          setTimeout(() => {
            setLogs(prev => [...prev, `Progress: ${i * 20}% complete`])
            if (i === 5) {
              setLogs(prev => [...prev, 'Simulation completed successfully'])
              setIsRunning(false)
            }
          }, i * 2000)
        }
      }
    } catch (error) {
      setLogs(prev => [...prev, 'Error: Failed to start simulation'])
      setIsRunning(false)
    }
  }

  const stopSimulation = () => {
    setIsRunning(false)
    setLogs(prev => [...prev, 'Simulation stopped by user'])
  }

  return (
    <LayoutWrapper>
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-nvidia mb-8">Simulation Control</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Simulation Configuration */}
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow">
            <h2 className="text-2xl font-semibold text-white mb-6">Configuration</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Number of Vehicles
                </label>
                <input
                  type="number"
                  value={vehicleCount}
                  onChange={(e) => setVehicleCount(Number(e.target.value))}
                  min="10"
                  max="500"
                  disabled={isRunning}
                  className="w-full px-4 py-2 bg-white/10 border border-nvidia/30 rounded-lg text-white focus:outline-none focus:border-nvidia"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  min="30"
                  max="600"
                  disabled={isRunning}
                  className="w-full px-4 py-2 bg-white/10 border border-nvidia/30 rounded-lg text-white focus:outline-none focus:border-nvidia"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Scenario
                </label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-4 py-2 bg-white/10 border border-nvidia/30 rounded-lg text-white focus:outline-none focus:border-nvidia"
                >
                  <option value="normal">Normal Traffic</option>
                  <option value="rush_hour">Rush Hour</option>
                  <option value="emergency">Emergency Response</option>
                  <option value="event">Major Event</option>
                  <option value="random">Random Events</option>
                </select>
              </div>
              
              <div className="pt-4">
                {!isRunning ? (
                  <button
                    onClick={startSimulation}
                    className="w-full px-6 py-3 bg-nvidia text-black font-semibold rounded-lg hover:bg-nvidia-dark transition-colors"
                  >
                    Start Simulation
                  </button>
                ) : (
                  <button
                    onClick={stopSimulation}
                    className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Stop Simulation
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Simulation Logs */}
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20">
            <h2 className="text-2xl font-semibold text-white mb-6">Simulation Logs</h2>
            
            <div className="bg-black/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="mb-2">
                    <span className="text-nvidia">[{new Date().toLocaleTimeString()}]</span>
                    <span className="text-gray-300 ml-2">{log}</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No simulation running</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Simulation Info */}
        <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20">
          <h2 className="text-2xl font-semibold text-white mb-4">About Simulations</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-400">
            <div>
              <h3 className="text-lg font-medium text-nvidia mb-2">Scenarios</h3>
              <ul className="space-y-1">
                <li>• <strong>Normal Traffic:</strong> Standard traffic patterns</li>
                <li>• <strong>Rush Hour:</strong> High density, peak hour simulation</li>
                <li>• <strong>Emergency:</strong> Tests emergency vehicle prioritization</li>
                <li>• <strong>Major Event:</strong> Simulates traffic around events</li>
                <li>• <strong>Random Events:</strong> Mixed scenarios with random events</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-nvidia mb-2">Metrics Tracked</h3>
              <ul className="space-y-1">
                <li>• Average wait time reduction</li>
                <li>• Intersection throughput</li>
                <li>• Fleet coordination efficiency</li>
                <li>• System fairness score</li>
                <li>• Emergency response times</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  )
}
