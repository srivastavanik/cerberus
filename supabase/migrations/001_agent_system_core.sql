-- CHUNK 1: CORE AGENT SYSTEM INFRASTRUCTURE
-- ==========================================
-- Creating tables in correct dependency order

-- Enable necessary extensions if not already enabled
-- Note: pgvector is not available in standard Supabase deployments
-- Using JSONB arrays for embeddings instead

-- Model configurations for different agent types (no dependencies)
CREATE TABLE model_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_name TEXT UNIQUE NOT NULL,
    model_provider TEXT NOT NULL DEFAULT 'nvidia',
    model_name TEXT NOT NULL DEFAULT 'nemotron-super-49b',
    
    -- Model parameters
    temperature FLOAT DEFAULT 0.6,
    top_p FLOAT DEFAULT 0.95,
    max_tokens INTEGER DEFAULT 4096,
    presence_penalty FLOAT DEFAULT 0.0,
    frequency_penalty FLOAT DEFAULT 0.0,
    
    -- Streaming and timeout settings
    stream_enabled BOOLEAN DEFAULT true,
    timeout_seconds INTEGER DEFAULT 30,
    retry_attempts INTEGER DEFAULT 3,
    
    -- Cost tracking
    cost_per_1k_tokens FLOAT DEFAULT 0.002,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NVIDIA Nemotron system prompts for different agent types (no dependencies)
CREATE TABLE agent_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_name TEXT UNIQUE NOT NULL,
    agent_type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Prompt components
    role_description TEXT NOT NULL,
    objectives TEXT[] NOT NULL,
    constraints TEXT[] NOT NULL,
    knowledge_base TEXT, -- Domain-specific knowledge
    
    -- Full system prompt
    system_prompt TEXT NOT NULL,
    
    -- Prompt engineering metadata
    temperature_override FLOAT,
    top_p_override FLOAT,
    presence_penalty_override FLOAT,
    frequency_penalty_override FLOAT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- Agent instances and their configuration (depends on model_configurations and agent_prompts)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT UNIQUE NOT NULL,
    agent_type TEXT NOT NULL CHECK (agent_type IN (
        'city_orchestrator',
        'district_coordinator',
        'fleet_coordinator',
        'intersection_manager',
        'vehicle_agent',
        'zone_controller',
        'special_service_coordinator'
    )),
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN (
        'inactive', 'initializing', 'active', 'busy', 'error', 'shutting_down'
    )),
    
    -- Agent capabilities and configuration
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    perception_radius_meters INTEGER DEFAULT 1000,
    decision_timeout_ms INTEGER DEFAULT 5000,
    max_concurrent_negotiations INTEGER DEFAULT 10,
    
    -- NVIDIA Nemotron configuration
    model_config_id UUID REFERENCES model_configurations(id),
    system_prompt_id UUID REFERENCES agent_prompts(id),
    
    -- Agent state and metrics
    current_state JSONB DEFAULT '{}'::jsonb,
    last_decision_time TIMESTAMPTZ,
    decisions_made INTEGER DEFAULT 0,
    success_rate FLOAT DEFAULT 0.0,
    average_response_time_ms FLOAT DEFAULT 0.0,
    
    -- Hierarchy and relationships
    parent_agent_id UUID REFERENCES agents(id),
    managed_area GEOMETRY(Polygon, 4326), -- For district/zone agents
    managed_entity_id TEXT, -- For vehicle/fleet agents
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent hierarchy relationships (depends on agents)
CREATE TABLE agent_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    child_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'supervises', 'coordinates_with', 'reports_to', 'peer'
    )),
    priority INTEGER DEFAULT 100,
    communication_protocol TEXT DEFAULT 'standard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(parent_agent_id, child_agent_id)
);

-- Agent decision history and explanations (depends on agents)
CREATE TABLE agent_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    decision_id TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Decision details
    decision_type TEXT NOT NULL,
    action_taken JSONB NOT NULL,
    alternatives_considered JSONB DEFAULT '[]'::jsonb,
    
    -- Reasoning and explanation
    reasoning_chain JSONB NOT NULL, -- Step-by-step reasoning
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    explanation TEXT NOT NULL, -- Human-readable explanation
    
    -- Context and inputs
    input_data JSONB NOT NULL,
    environmental_context JSONB DEFAULT '{}'::jsonb,
    active_constraints JSONB DEFAULT '[]'::jsonb,
    
    -- Performance and outcomes
    execution_time_ms INTEGER,
    outcome TEXT CHECK (outcome IN ('success', 'partial_success', 'failure', 'pending')),
    outcome_details JSONB DEFAULT '{}'::jsonb,
    impact_score FLOAT, -- Measured impact of decision
    
    -- Learning feedback
    human_override BOOLEAN DEFAULT false,
    override_reason TEXT,
    learning_weight FLOAT DEFAULT 1.0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent memory systems (depends on agents and agent_decisions)
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'conversation', 'entity', 'pattern', 'vector', 'episodic'
    )),
    
    -- Memory content
    content TEXT,
    embedding JSONB, -- Stores embedding as JSON array (was VECTOR(1536))
    embedding_model TEXT DEFAULT 'text-embedding-ada-002',
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Memory importance and decay
    importance_score FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    decay_rate FLOAT DEFAULT 0.01,
    
    -- Context and relationships
    related_entity_id TEXT,
    related_decision_id UUID REFERENCES agent_decisions(id),
    conversation_id TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- For temporary memories
);

-- Create indexes for performance
CREATE INDEX idx_model_configurations_name ON model_configurations(config_name);
CREATE INDEX idx_model_configurations_provider ON model_configurations(model_provider);

CREATE INDEX idx_agent_prompts_type ON agent_prompts(agent_type);
CREATE INDEX idx_agent_prompts_active ON agent_prompts(is_active);

CREATE INDEX idx_agents_type ON agents(agent_type);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_parent ON agents(parent_agent_id);
CREATE INDEX idx_agents_area ON agents USING GIST(managed_area);

CREATE INDEX idx_agent_hierarchy_parent ON agent_hierarchy(parent_agent_id);
CREATE INDEX idx_agent_hierarchy_child ON agent_hierarchy(child_agent_id);

CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_id);
CREATE INDEX idx_agent_memory_type ON agent_memory(memory_type);
-- Note: Vector similarity index removed - use application-level similarity search
CREATE INDEX idx_agent_memory_importance ON agent_memory(importance_score DESC);

CREATE INDEX idx_agent_decisions_agent ON agent_decisions(agent_id);
CREATE INDEX idx_agent_decisions_timestamp ON agent_decisions(timestamp DESC);
CREATE INDEX idx_agent_decisions_type ON agent_decisions(decision_type);
CREATE INDEX idx_agent_decisions_outcome ON agent_decisions(outcome);

-- Enable Row Level Security
ALTER TABLE model_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access
-- Read policies
CREATE POLICY "Enable read access for all" ON model_configurations FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON agent_prompts FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON agents FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON agent_hierarchy FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON agent_memory FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON agent_decisions FOR SELECT USING (true);

-- Insert policies
CREATE POLICY "Enable insert for all" ON model_configurations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON agent_prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON agent_hierarchy FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON agent_memory FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON agent_decisions FOR INSERT WITH CHECK (true);

-- Update policies
CREATE POLICY "Enable update for all" ON model_configurations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON agent_prompts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON agents FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON agent_hierarchy FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON agent_memory FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON agent_decisions FOR UPDATE USING (true) WITH CHECK (true);

-- Delete policies
CREATE POLICY "Enable delete for all" ON model_configurations FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON agent_prompts FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON agents FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON agent_hierarchy FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON agent_memory FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON agent_decisions FOR DELETE USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_decisions;

-- Insert default model configuration for NVIDIA Nemotron
INSERT INTO model_configurations (config_name, model_provider, model_name, temperature, top_p, max_tokens)
VALUES 
    ('default_nemotron', 'nvidia', 'nemotron-super-49b', 0.6, 0.95, 4096),
    ('high_precision', 'nvidia', 'nemotron-super-49b', 0.3, 0.9, 4096),
    ('creative_mode', 'nvidia', 'nemotron-super-49b', 0.8, 0.97, 4096);

-- Insert default agent prompts
INSERT INTO agent_prompts (prompt_name, agent_type, role_description, objectives, constraints, system_prompt, created_by)
VALUES 
    ('city_orchestrator_v1', 'city_orchestrator', 
     'You are the City Orchestrator AI for San Francisco''s autonomous vehicle coordination system.',
     ARRAY['Optimize city-wide traffic flow', 'Ensure emergency vehicle priority', 'Balance fairness across all AV companies', 'Monitor and prevent congestion'],
     ARRAY['Respect privacy levels of each company', 'Maintain emergency response times under 4 minutes', 'Ensure no single company gets preferential treatment'],
     'You are the City Orchestrator AI managing San Francisco''s autonomous vehicle network. Your role is to optimize city-wide traffic flow while ensuring fairness across all AV companies (Waymo, Zoox, Cruise). You have access to aggregated traffic data, weather conditions, and special event information. Always prioritize emergency vehicles and maintain system-wide efficiency. Make decisions based on multi-objective optimization considering travel times, fairness, and environmental impact.',
     'system'),
     
    ('district_coordinator_v1', 'district_coordinator',
     'You are a District Coordinator AI managing traffic flow within a specific San Francisco district.',
     ARRAY['Optimize local traffic patterns', 'Coordinate with neighboring districts', 'Manage intersection priorities', 'Handle local events'],
     ARRAY['Respect district boundaries', 'Coordinate but don''t override city-level decisions', 'Maintain local service levels'],
     'You are a District Coordinator AI responsible for managing autonomous vehicle traffic within your assigned San Francisco district. You coordinate with intersection managers, negotiate with neighboring districts, and implement city-wide directives while optimizing for local conditions. Consider district-specific factors like local businesses, schools, and traffic patterns.',
     'system');
