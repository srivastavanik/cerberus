const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTables() {
  console.log('🔍 Checking Supabase database tables...\n')

  // Check vehicle_states table
  console.log('📍 Checking vehicle_states table:')
  try {
    const { data: vehicles, error: vehicleError, count } = await supabase
      .from('vehicle_states')
      .select('*', { count: 'exact' })
      .limit(5)

    if (vehicleError) {
      console.error('Error:', vehicleError.message)
    } else {
      console.log(`Total vehicles: ${count}`)
      if (vehicles && vehicles.length > 0) {
        console.log('Sample vehicle data:')
        vehicles.forEach(v => {
          console.log(`- Vehicle ${v.vehicle_id}: ${v.company}, Status: ${v.status}`)
          console.log(`  Position: ${JSON.stringify(v.grid_position)}`)
        })
      } else {
        console.log('❌ No vehicle data found')
      }
    }
  } catch (err) {
    console.error('Error accessing vehicle_states:', err.message)
  }

  console.log('\n🚦 Checking intersection_states table:')
  try {
    const { data: intersections, error: intersectionError, count: intCount } = await supabase
      .from('intersection_states')
      .select('*', { count: 'exact' })
      .limit(5)

    if (intersectionError) {
      console.error('Error:', intersectionError.message)
    } else {
      console.log(`Total intersections: ${intCount}`)
      if (intersections && intersections.length > 0) {
        console.log('Sample intersection data:')
        intersections.forEach(i => {
          console.log(`- Intersection ${i.intersection_id}: Wait time: ${i.average_wait_time}s`)
          console.log(`  Active negotiations: ${i.active_negotiations?.length || 0}`)
        })
      } else {
        console.log('❌ No intersection data found')
      }
    }
  } catch (err) {
    console.error('Error accessing intersection_states:', err.message)
  }

  console.log('\n📊 Checking system_metrics table:')
  try {
    const { data: metrics, error: metricsError, count: metricsCount } = await supabase
      .from('system_metrics')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .limit(3)

    if (metricsError) {
      console.error('Error:', metricsError.message)
    } else {
      console.log(`Total metrics records: ${metricsCount}`)
      if (metrics && metrics.length > 0) {
        console.log('Recent metrics:')
        metrics.forEach(m => {
          console.log(`- ${m.timestamp}: ${m.total_vehicles} vehicles, ${m.coordinations_per_minute} coord/min`)
        })
      } else {
        console.log('❌ No metrics data found')
      }
    }
  } catch (err) {
    console.error('Error accessing system_metrics:', err.message)
  }

  console.log('\n🔍 Checking coordination_events table:')
  try {
    const { data: events, error: eventsError, count: eventsCount } = await supabase
      .from('coordination_events')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .limit(3)

    if (eventsError) {
      console.error('Error:', eventsError.message)
    } else {
      console.log(`Total coordination events: ${eventsCount}`)
      if (events && events.length > 0) {
        console.log('Recent events:')
        events.forEach(e => {
          console.log(`- ${e.timestamp}: ${e.event_type}`)
        })
      } else {
        console.log('❌ No coordination events found')
      }
    }
  } catch (err) {
    console.error('Error accessing coordination_events:', err.message)
  }
}

checkTables().catch(console.error)
