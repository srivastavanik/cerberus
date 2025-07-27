// NVIDIA Nemotron Integration

interface NemotronResponse {
  id: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    total_tokens: number
    completion_tokens: number
  }
}

interface ReasoningContext {
  type: 'city_optimization' | 'intersection_negotiation' | 'emergency_routing' | 'event_handling'
  data: any
}

class NemotronClient {
  private apiKey: string
  private baseUrl = 'https://integrate.api.nvidia.com/v1'
  private model = 'nvidia/llama-3.3-nemotron-super-49b-v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async reason(context: ReasoningContext): Promise<any> {
    const systemPrompt = this.getSystemPrompt(context.type)
    const userPrompt = this.formatUserPrompt(context)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1024,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status}`)
      }

      const data: NemotronResponse = await response.json()
      const content = data.choices[0]?.message?.content
      
      try {
        return JSON.parse(content)
      } catch {
        return { error: 'Failed to parse response', raw: content }
      }
    } catch (error) {
      console.error('Nemotron reasoning error:', error)
      return { error: 'Reasoning failed', details: error }
    }
  }

  private getSystemPrompt(type: ReasoningContext['type']): string {
    const prompts = {
      city_optimization: `You are an AI traffic optimization system for San Francisco autonomous vehicles. 
        Analyze city-wide traffic patterns and provide multi-objective optimization decisions.
        Consider: congestion levels, fairness across companies, emergency vehicle priorities, and special events.
        Always respond with valid JSON containing: action, priority_zones, rebalancing_instructions, and reasoning.`,
      
      intersection_negotiation: `You are an intersection negotiation agent managing autonomous vehicle crossings.
        Evaluate crossing requests based on: wait time, passenger count, battery level, and fairness.
        Implement auction-based priority with company fairness penalties.
        Respond with JSON: crossing_order, wait_times, fairness_adjustments, and explanation.`,
      
      emergency_routing: `You are an emergency response coordinator for autonomous vehicles.
        Create rapid corridors for emergency vehicles by coordinating AVs.
        Minimize disruption while ensuring fastest emergency response.
        Respond with JSON: corridor_path, affected_vehicles, reroute_instructions, time_saved.`,
      
      event_handling: `You are a special event traffic manager for San Francisco.
        Handle traffic surges from events like Giants games, concerts, or conferences.
        Distribute load across routes and prevent gridlock.
        Respond with JSON: routing_strategy, capacity_distribution, expected_improvement.`
    }

    return prompts[type]
  }

  private formatUserPrompt(context: ReasoningContext): string {
    return `Current situation:\n${JSON.stringify(context.data, null, 2)}\n\nProvide optimal coordination strategy.`
  }
}

// Singleton instance
let nemotronClient: NemotronClient | null = null

export function getNemotronClient(): NemotronClient {
  if (!nemotronClient) {
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY not configured')
    }
    nemotronClient = new NemotronClient(apiKey)
  }
  return nemotronClient
}

// Helper functions for specific reasoning tasks
export async function optimizeCityTraffic(trafficData: any) {
  const client = getNemotronClient()
  return client.reason({
    type: 'city_optimization',
    data: trafficData
  })
}

export async function negotiateIntersection(intersectionData: any) {
  const client = getNemotronClient()
  return client.reason({
    type: 'intersection_negotiation',
    data: intersectionData
  })
}

export async function routeEmergencyVehicle(emergencyData: any) {
  const client = getNemotronClient()
  return client.reason({
    type: 'emergency_routing',
    data: emergencyData
  })
}

export async function handleSpecialEvent(eventData: any) {
  const client = getNemotronClient()
  return client.reason({
    type: 'event_handling',
    data: eventData
  })
}
