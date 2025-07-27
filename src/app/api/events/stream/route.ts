import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Store active connections
const clients = new Map<string, ReadableStreamDefaultController>()

export async function GET(request: NextRequest) {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Create a new ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      // Store the controller for this client
      clients.set(clientId, controller)
      
      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'connection',
          clientId,
          message: 'Connected to SF AV Coordination event stream',
          timestamp: new Date().toISOString()
        })}\n\n`)
      )
      
      // Set up periodic updates
      const updateInterval = setInterval(async () => {
        try {
          // Get latest coordination events
          const { data: events } = await supabase
            .from('coordination_events')
            .select('*')
            .gte('timestamp', new Date(Date.now() - 30000).toISOString())
            .order('timestamp', { ascending: false })
            .limit(5)
          
          // Get system metrics
          const { data: metrics } = await supabase
            .from('system_metrics')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1)
            .single()
          
          // Get active vehicle counts by district
          const { data: districtStats } = await supabase
            .from('district_metrics')
            .select('district_name, vehicle_density, congestion_level')
            .order('congestion_level', { ascending: false })
            .limit(5)
          
          // Send update
          const update = {
            type: 'update',
            timestamp: new Date().toISOString(),
            events: events || [],
            systemMetrics: metrics,
            hotspots: districtStats || [],
            activeClients: clients.size
          }
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(update)}\n\n`)
          )
        } catch (error) {
          console.error('Error sending update:', error)
        }
      }, 5000) // Send updates every 5 seconds
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(updateInterval)
        clients.delete(clientId)
        controller.close()
      })
    },
    
    cancel() {
      // Clean up when the stream is cancelled
      clients.delete(clientId)
    }
  })
  
  // Return the stream with appropriate headers for SSE
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// POST endpoint to broadcast custom events
export async function POST(request: NextRequest) {
  try {
    const event = await request.json()
    
    // Validate event structure
    if (!event.type || !event.data) {
      return NextResponse.json({
        error: 'Invalid event format. Must include type and data.'
      }, { status: 400 })
    }
    
    // Broadcast to all connected clients
    const encoder = new TextEncoder()
    const message = encoder.encode(`data: ${JSON.stringify({
      type: 'broadcast',
      event,
      timestamp: new Date().toISOString()
    })}\n\n`)
    
    let broadcastCount = 0
    clients.forEach((controller, clientId) => {
      try {
        controller.enqueue(message)
        broadcastCount++
      } catch (error) {
        // Client disconnected, remove from map
        clients.delete(clientId)
      }
    })
    
    return NextResponse.json({
      success: true,
      message: `Event broadcasted to ${broadcastCount} clients`,
      totalClients: clients.size
    })
    
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json({
      error: 'Failed to broadcast event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Utility function to send specific event types
export function broadcastCoordinationEvent(event: any) {
  const encoder = new TextEncoder()
  const message = encoder.encode(`data: ${JSON.stringify({
    type: 'coordination_event',
    event,
    timestamp: new Date().toISOString()
  })}\n\n`)
  
  clients.forEach((controller, clientId) => {
    try {
      controller.enqueue(message)
    } catch (error) {
      clients.delete(clientId)
    }
  })
}

export function broadcastEmergency(location: [number, number], details: any) {
  const encoder = new TextEncoder()
  const message = encoder.encode(`data: ${JSON.stringify({
    type: 'emergency',
    location,
    details,
    timestamp: new Date().toISOString(),
    priority: 1000
  })}\n\n`)
  
  clients.forEach((controller, clientId) => {
    try {
      controller.enqueue(message)
    } catch (error) {
      clients.delete(clientId)
    }
  })
}

export function broadcastSystemStatus(status: any) {
  const encoder = new TextEncoder()
  const message = encoder.encode(`data: ${JSON.stringify({
    type: 'system_status',
    status,
    timestamp: new Date().toISOString()
  })}\n\n`)
  
  clients.forEach((controller, clientId) => {
    try {
      controller.enqueue(message)
    } catch (error) {
      clients.delete(clientId)
    }
  })
}
