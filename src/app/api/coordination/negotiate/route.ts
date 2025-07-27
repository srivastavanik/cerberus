import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getNemotronClient } from '@/lib/nvidia'

interface NegotiationRequest {
  type: 'intersection' | 'lane_merge' | 'rebalancing' | 'emergency' | 'charging'
  participants: string[]
  location: { lat: number; lng: number }
  priority?: number
  constraints?: any
}

interface NegotiationResult {
  negotiationId: string
  decision: string
  allocation: Record<string, any>
  fairnessScore: number
  efficiency: number
  reasoning: string
}

export async function POST(request: NextRequest) {
  try {
    const negotiation: NegotiationRequest = await request.json()
    
    console.log(`Processing ${negotiation.type} negotiation with ${negotiation.participants.length} participants`)

    // Create negotiation record
    const negotiationId = `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Get AI decision if available
    let aiDecision = null
    try {
      const nemotron = getNemotronClient()
      aiDecision = await nemotron.reason({
        type: 'intersection_negotiation',
        data: {
          negotiationType: negotiation.type,
          participants: negotiation.participants,
          location: negotiation.location,
          constraints: negotiation.constraints || {},
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      console.log('AI reasoning unavailable, using rule-based approach')
    }

    // Process negotiation based on type
    const result = await processNegotiation(negotiation, aiDecision)
    
    // Record the negotiation event
    await supabase.from('coordination_events').insert({
      event_id: negotiationId,
      event_type: `${negotiation.type}_negotiation`,
      participants: negotiation.participants,
      location: { 
        type: 'Point', 
        coordinates: [negotiation.location.lng, negotiation.location.lat] 
      },
      timestamp: new Date().toISOString(),
      duration_ms: 5000 + Math.random() * 10000,
      success_rate: result.efficiency,
      priority: negotiation.priority || 500,
      coordination_algorithm: aiDecision ? 'ai_enhanced' : 'rule_based',
      outcome: {
        decision: result.decision,
        allocation: result.allocation,
        fairness: result.fairnessScore,
        efficiency: result.efficiency
      },
      metadata: {
        ai_used: !!aiDecision,
        negotiation_type: negotiation.type,
        constraints: negotiation.constraints
      }
    })

    // Send messages to participants about the outcome
    for (const participant of negotiation.participants) {
      await supabase.from('coordination_messages').insert({
        msg_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        sender: 'coordination_system',
        recipient: participant,
        message_type: 'info',
        priority: negotiation.priority || 5,
        payload: {
          negotiationId,
          type: 'negotiation_result',
          allocation: result.allocation[participant] || {},
          globalOutcome: result.decision
        },
        ttl: 300 // 5 minutes
      })
    }

    return NextResponse.json({
      success: true,
      negotiationId,
      result,
      aiAssisted: !!aiDecision,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Negotiation error:', error)
    return NextResponse.json({
      error: 'Failed to process negotiation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function processNegotiation(
  negotiation: NegotiationRequest, 
  aiDecision: any
): Promise<NegotiationResult> {
  switch (negotiation.type) {
    case 'intersection':
      return processIntersectionNegotiation(negotiation, aiDecision)
    
    case 'lane_merge':
      return processLaneMergeNegotiation(negotiation, aiDecision)
    
    case 'rebalancing':
      return processRebalancingNegotiation(negotiation, aiDecision)
    
    case 'emergency':
      return processEmergencyNegotiation(negotiation, aiDecision)
    
    case 'charging':
      return processChargingNegotiation(negotiation, aiDecision)
    
    default:
      return {
        negotiationId: '',
        decision: 'unknown',
        allocation: {},
        fairnessScore: 50,
        efficiency: 50,
        reasoning: 'Unknown negotiation type'
      }
  }
}

async function processIntersectionNegotiation(
  negotiation: NegotiationRequest,
  aiDecision: any
): Promise<NegotiationResult> {
  // If AI provided a decision, use it
  if (aiDecision && !aiDecision.error) {
    return {
      negotiationId: '',
      decision: 'ai_optimized',
      allocation: aiDecision.crossing_order || {},
      fairnessScore: aiDecision.fairness_adjustments?.score || 85,
      efficiency: 90,
      reasoning: aiDecision.explanation || 'AI-optimized intersection crossing'
    }
  }

  // Fallback to rule-based approach
  const participants = negotiation.participants
  const waitTimes: Record<string, number> = {}
  
  // Simulate wait times (in reality, would fetch from vehicle states)
  participants.forEach(p => {
    waitTimes[p] = Math.floor(Math.random() * 120) + 10
  })
  
  // Sort by wait time (longest waiting goes first)
  const sorted = participants.sort((a, b) => waitTimes[b] - waitTimes[a])
  
  const allocation: Record<string, any> = {}
  sorted.forEach((participant, index) => {
    allocation[participant] = {
      crossingOrder: index + 1,
      estimatedWait: index * 3, // 3 seconds per vehicle
      priority: sorted.length - index
    }
  })
  
  return {
    negotiationId: '',
    decision: 'wait_time_based',
    allocation,
    fairnessScore: 75,
    efficiency: 80,
    reasoning: 'Vehicles with longest wait times given priority'
  }
}

async function processLaneMergeNegotiation(
  negotiation: NegotiationRequest,
  aiDecision: any
): Promise<NegotiationResult> {
  // Implement zipper merge logic
  const participants = negotiation.participants
  const allocation: Record<string, any> = {}
  
  // Alternate between lanes
  participants.forEach((participant, index) => {
    allocation[participant] = {
      mergeOrder: index + 1,
      lane: index % 2 === 0 ? 'left' : 'right',
      action: index % 2 === 0 ? 'merge' : 'yield'
    }
  })
  
  return {
    negotiationId: '',
    decision: 'zipper_merge',
    allocation,
    fairnessScore: 90,
    efficiency: 85,
    reasoning: 'Optimal zipper merge pattern for traffic flow'
  }
}

async function processRebalancingNegotiation(
  negotiation: NegotiationRequest,
  aiDecision: any
): Promise<NegotiationResult> {
  // Get district congestion levels
  const { data: districts } = await supabase
    .from('district_metrics')
    .select('district_name, congestion_level, vehicle_density')
    .order('congestion_level', { ascending: true })
  
  const allocation: Record<string, any> = {}
  const targetDistricts = districts?.slice(0, 3).map(d => d.district_name) || []
  
  // Distribute vehicles to less congested districts
  negotiation.participants.forEach((participant, index) => {
    const targetDistrict = targetDistricts[index % targetDistricts.length]
    allocation[participant] = {
      action: 'relocate',
      targetDistrict,
      incentive: 'reduced_wait_time',
      estimatedImprovement: '25%'
    }
  })
  
  return {
    negotiationId: '',
    decision: 'load_balance',
    allocation,
    fairnessScore: 80,
    efficiency: 75,
    reasoning: `Rebalancing ${negotiation.participants.length} vehicles to less congested districts`
  }
}

async function processEmergencyNegotiation(
  negotiation: NegotiationRequest,
  aiDecision: any
): Promise<NegotiationResult> {
  // Emergency vehicles get absolute priority
  const allocation: Record<string, any> = {}
  
  negotiation.participants.forEach(participant => {
    allocation[participant] = {
      action: 'yield_immediately',
      pullOverDirection: Math.random() > 0.5 ? 'right' : 'left',
      duration: 60, // seconds
      priority: 0 // lowest priority, must yield
    }
  })
  
  return {
    negotiationId: '',
    decision: 'emergency_override',
    allocation,
    fairnessScore: 100, // Fair because it's an emergency
    efficiency: 100,
    reasoning: 'Emergency vehicle corridor - all vehicles must yield'
  }
}

async function processChargingNegotiation(
  negotiation: NegotiationRequest,
  aiDecision: any
): Promise<NegotiationResult> {
  // Priority based on battery level
  const batteryLevels: Record<string, number> = {}
  
  // Simulate battery levels
  negotiation.participants.forEach(p => {
    batteryLevels[p] = Math.floor(Math.random() * 60) + 10
  })
  
  // Sort by battery level (lowest first)
  const sorted = negotiation.participants.sort((a, b) => batteryLevels[a] - batteryLevels[b])
  
  const allocation: Record<string, any> = {}
  sorted.forEach((participant, index) => {
    allocation[participant] = {
      chargingSlot: index < 3 ? index + 1 : 0, // Only 3 charging slots
      waitTime: index < 3 ? 0 : (index - 2) * 20, // 20 min wait per position
      priority: sorted.length - index,
      batteryLevel: batteryLevels[participant]
    }
  })
  
  return {
    negotiationId: '',
    decision: 'battery_priority',
    allocation,
    fairnessScore: 85,
    efficiency: 80,
    reasoning: 'Vehicles with lowest battery levels given charging priority'
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get recent negotiations
    const { data: negotiations } = await supabase
      .from('coordination_events')
      .select('*')
      .like('event_type', '%negotiation%')
      .order('timestamp', { ascending: false })
      .limit(20)
    
    return NextResponse.json({
      negotiations: negotiations || [],
      total: negotiations?.length || 0,
      message: 'Recent negotiation history'
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch negotiations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
