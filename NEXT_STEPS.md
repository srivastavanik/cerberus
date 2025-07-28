# SF AV Coordination System - Next Steps

## ✅ Completed
- Database schema migration (all 4 chunks successfully applied)
- Fixed pgvector dependency issue

## 🚀 Immediate Next Steps

### 1. Fix Critical Build Errors

#### a) Fix fleet-coordinator.ts syntax error
Check for literal `\n` characters on lines 55 and 59 that need to be removed.

#### b) Update next.config.js
Remove the deprecated 'appDir' option from experimental settings.

#### c) Fix NVIDIA API Integration
Update nvidia.ts to use the proper OpenAI client format with your API key.

### 2. Initialize Core Agents in Database

Run these SQL commands to create the initial agents:

```sql
-- Create City Orchestrator
WITH config AS (
  SELECT id FROM model_configurations WHERE config_name = 'default_nemotron'
),
prompt AS (
  SELECT id FROM agent_prompts WHERE prompt_name = 'city_orchestrator_v1'
)
INSERT INTO agents (
  agent_id, agent_type, agent_name,
  model_config_id, system_prompt_id,
  capabilities, perception_radius_meters
) 
SELECT 
  'city_orchestrator_main', 'city_orchestrator',
  'SF City Traffic Orchestrator',
  config.id, prompt.id,
  '["city_overview", "emergency_response", "fairness_enforcement"]'::jsonb,
  50000
FROM config, prompt;

-- Create District Coordinators for each SF district
-- (Add similar INSERT statements for each district)
```

### 3. Set Up NVIDIA Integration

1. **Get NVIDIA API Key**
   - Sign up at https://build.nvidia.com/
   - Get your API key for Nemotron models

2. **Update .env.local**
   ```
   NVIDIA_API_KEY=your_api_key_here
   ```

3. **Update nvidia.ts**
   - Use OpenAI client format with NVIDIA endpoints
   - Configure for Nemotron model access

### 4. Implement Core API Routes

Priority order:
1. `/api/agents/start` - Initialize agent system
2. `/api/agents/status` - Get system status
3. `/api/data/generate` - Generate test data
4. `/api/simulation/start` - Start simulations
5. `/api/events/stream` - Real-time updates

### 5. Create Agent Implementation

1. **Base Agent Class**
   - Memory management
   - Decision making
   - Communication protocols

2. **Specialized Agents**
   - City Orchestrator
   - District Coordinators
   - Fleet Coordinators
   - Intersection Managers

### 6. Set Up Real-time Communication

1. **WebSocket Server**
   - Agent-to-agent messaging
   - Dashboard updates
   - Event streaming

2. **Supabase Realtime**
   - Subscribe to agent_decisions
   - Monitor emergency_corridors
   - Track system_anomalies

### 7. Build Dashboard Components

1. **Main Dashboard**
   - City-wide overview
   - Real-time metrics
   - Agent status

2. **District Views**
   - Local traffic patterns
   - Agent negotiations
   - Performance metrics

3. **Simulation Controls**
   - Scenario selection
   - Parameter tuning
   - Results analysis

### 8. Testing & Validation

1. **Unit Tests**
   - Agent decision logic
   - API endpoints
   - Database operations

2. **Integration Tests**
   - Multi-agent coordination
   - Emergency scenarios
   - Fairness enforcement

3. **Load Testing**
   - Simulate 1000+ vehicles
   - Stress test negotiations
   - Measure response times

## 📋 Development Checklist

- [ ] Fix build errors
- [ ] Get NVIDIA API access
- [ ] Initialize database agents
- [ ] Implement core APIs
- [ ] Create agent classes
- [ ] Set up WebSockets
- [ ] Build dashboard UI
- [ ] Write tests
- [ ] Run simulations
- [ ] Optimize performance

## 🎯 First Milestone

Get a basic simulation running with:
- 1 City Orchestrator
- 3 District Coordinators
- 10 simulated vehicles
- Basic dashboard showing real-time positions

## 📚 Resources

- NVIDIA Nemotron Docs: https://docs.nvidia.com/nim/
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Next.js App Router: https://nextjs.org/docs/app

## 🆘 Common Issues

1. **"Cannot find module" errors**
   - Run `npm install`
   - Check tsconfig.json paths

2. **Database connection issues**
   - Verify NEXT_PUBLIC_SUPABASE_URL
   - Check NEXT_PUBLIC_SUPABASE_ANON_KEY

3. **NVIDIA API errors**
   - Verify API key is set
   - Check rate limits
   - Ensure correct model name

## 🚦 Ready to Start?

1. Fix the build errors first
2. Get your NVIDIA API key
3. Start with the simplest API route
4. Build incrementally!
