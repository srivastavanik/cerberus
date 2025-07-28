const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please update .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function populateDatabase() {
  console.log('🚀 Starting database population...')

  try {
    // 1. Insert Agents
    console.log('📤 Inserting agents...')
    const agents = [
      {
        agent_id: 'master-orchestrator',
        agent_type: 'master_orchestrator',
        configuration: { update_interval: 5000, coordination_threshold: 0.7 },
        is_active: true
      },
      {
        agent_id: 'district-soma',
        agent_type: 'district_agent',
        configuration: { district: 'soma', congestion_threshold: 0.6 },
        is_active: true
      },
      {
        agent_id: 'district-mission',
        agent_type: 'district_agent',
        configuration: { district: 'mission', congestion_threshold: 0.6 },
        is_active: true
      },
      {
        agent_id: 'fleet-waymo',
        agent_type: 'fleet_coordinator',
        configuration: { company: 'waymo', max_vehicles: 50 },
        is_active: true
      },
      {
        agent_id: 'fleet-zoox',
        agent_type: 'fleet_coordinator',
        configuration: { company: 'zoox', max_vehicles: 40 },
        is_active: true
      },
      {
        agent_id: 'fleet-cruise',
        agent_type: 'fleet_coordinator',
        configuration: { company: 'cruise', max_vehicles: 45 },
        is_active: true
      }
    ]

    const { error: agentError } = await supabase
      .from('agents')
      .upsert(agents, { onConflict: 'agent_id' })

    if (agentError) throw agentError
    console.log('✅ Agents inserted')

    // 2. Insert Vehicle States
    console.log('📤 Inserting vehicle states...')
    const vehicleStates = []
    const companies = ['waymo', 'zoox', 'cruise']
    const statuses = ['idle', 'enroute', 'charging', 'picking_up']
    const districts = ['soma', 'mission', 'castro', 'richmond', 'sunset', 'marina', 'financial_district', 'chinatown']

    for (let i = 1; i <= 50; i++) {
      const company = companies[Math.floor(Math.random() * companies.length)]
      vehicleStates.push({
        vehicle_id: `veh-${i}-${company}`,
        company: company,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        grid_position: {
          type: 'Point',
          coordinates: [
            -122.4194 + (Math.random() - 0.5) * 0.15,
            37.7749 + (Math.random() - 0.5) * 0.1
          ]
        },
        battery_level: Math.floor(Math.random() * 60 + 40),
        passenger_count: Math.floor(Math.random() * 4),
        anonymized_data: {
          district: districts[Math.floor(Math.random() * districts.length)],
          wait_time: Math.floor(Math.random() * 300),
          trip_id: `trip-${i}`
        }
      })
    }

    const { error: vehicleError } = await supabase
      .from('vehicle_states')
      .insert(vehicleStates)

    if (vehicleError) throw vehicleError
    console.log('✅ Vehicle states inserted')

    // 3. Insert District Metrics
    console.log('📤 Inserting district metrics...')
    const districtMetrics = []
    
    for (const district of districts) {
      districtMetrics.push({
        district_name: district,
        vehicle_density: Math.floor(Math.random() * 20 + 5),
        congestion_level: Math.random() * 0.8,
        average_speed: Math.random() * 20 + 15,
        coordination_score: Math.random() * 0.3 + 0.7,
        active_intersections: Math.floor(Math.random() * 10 + 5),
        metrics_data: {
          throughput: Math.random() * 100 + 50,
          wait_times: Math.random() * 180 + 60
        }
      })
    }

    const { error: districtError } = await supabase
      .from('district_metrics')
      .insert(districtMetrics)

    if (districtError) throw districtError
    console.log('✅ District metrics inserted')

    // 4. Insert Intersection States
    console.log('📤 Inserting intersection states...')
    const intersectionStates = []
    const intersections = [
      { id: 'int-montgomery-market', name: 'Montgomery & Market', coords: [-122.4028, 37.7896] },
      { id: 'int-mission-3rd', name: 'Mission & 3rd', coords: [-122.4032, 37.7859] },
      { id: 'int-howard-4th', name: 'Howard & 4th', coords: [-122.4048, 37.7827] },
      { id: 'int-folsom-2nd', name: 'Folsom & 2nd', coords: [-122.3961, 37.7885] }
    ]

    for (const intersection of intersections) {
      intersectionStates.push({
        intersection_id: intersection.id,
        status: Math.random() > 0.8 ? 'congested' : 'normal',
        vehicle_count: Math.floor(Math.random() * 15),
        average_wait_time: Math.floor(Math.random() * 120 + 30),
        signal_phase: ['green_ns', 'green_ew', 'yellow'][Math.floor(Math.random() * 3)],
        optimization_active: Math.random() > 0.5,
        coordinates: {
          type: 'Point',
          coordinates: intersection.coords
        }
      })
    }

    const { error: intersectionError } = await supabase
      .from('intersection_states')
      .insert(intersectionStates)

    if (intersectionError) throw intersectionError
    console.log('✅ Intersection states inserted')

    // 5. Insert Fleet Stats
    console.log('📤 Inserting fleet stats...')
    const fleetStats = []
    
    for (const company of companies) {
      fleetStats.push({
        company: company,
        total_vehicles: Math.floor(Math.random() * 20 + 30),
        active_vehicles: Math.floor(Math.random() * 15 + 20),
        idle_vehicles: Math.floor(Math.random() * 10 + 5),
        average_utilization: Math.random() * 0.3 + 0.6,
        revenue_per_hour: Math.random() * 500 + 1000,
        metrics: {
          trips_completed: Math.floor(Math.random() * 100 + 200),
          average_trip_duration: Math.floor(Math.random() * 15 + 10),
          customer_rating: Math.random() * 0.5 + 4.5
        }
      })
    }

    const { error: fleetError } = await supabase
      .from('fleet_stats')
      .insert(fleetStats)

    if (fleetError) throw fleetError
    console.log('✅ Fleet stats inserted')

    // 6. Insert System Metrics
    console.log('📤 Inserting system metrics...')
    const systemMetrics = {
      total_vehicles: 150,
      coordinations_per_minute: 12.5,
      average_wait_reduction: 0.35,
      fairness_score: 0.92,
      district_congestion_levels: {
        soma: 0.7,
        mission: 0.65,
        castro: 0.3,
        richmond: 0.4,
        sunset: 0.35
      }
    }

    const { error: systemError } = await supabase
      .from('system_metrics')
      .insert(systemMetrics)

    if (systemError) throw systemError
    console.log('✅ System metrics inserted')

    console.log('\n🎉 Database population complete!')
    console.log('You can now run the application and see real-time data.')

  } catch (error) {
    console.error('❌ Error populating database:', error)
    process.exit(1)
  }
}

// Run the population
populateDatabase()
