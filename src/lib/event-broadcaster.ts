// Store active connections
export const clients = new Map<string, ReadableStreamDefaultController>()

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
