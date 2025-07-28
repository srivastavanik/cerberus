-- CHUNK 3: ADVANCED COORDINATION & LEARNING
-- ==========================================
-- Negotiation, fairness, emergency management, and learning

-- Multi-round negotiations between agents
CREATE TABLE negotiations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negotiation_id TEXT UNIQUE NOT NULL,
    negotiation_type TEXT NOT NULL CHECK (negotiation_type IN (
        'intersection_priority', 'corridor_allocation', 'resource_sharing',
        'emergency_routing', 'district_transfer', 'fleet_balancing'
    )),
    
    -- Participants
    initiator_agent_id UUID NOT NULL REFERENCES agents(id),
    participant_agent_ids UUID[] NOT NULL,
    
    -- Negotiation state
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
        'initiated', 'proposing', 'counter_proposing', 'voting',
        'finalizing', 'completed', 'failed', 'timeout'
    )),
    current_round INTEGER DEFAULT 1,
    max_rounds INTEGER DEFAULT 5,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    
    -- Negotiation subject
    subject_type TEXT NOT NULL,
    subject_data JSONB NOT NULL,
    constraints JSONB DEFAULT '[]'::jsonb,
    
    -- Current proposal
    current_proposal JSONB,
    proposal_history JSONB DEFAULT '[]'::jsonb,
    
    -- Outcome
    final_agreement JSONB,
    agreement_score FLOAT,
    implementation_status TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consensus decisions requiring voting
CREATE TABLE consensus_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id TEXT UNIQUE NOT NULL,
    negotiation_id UUID REFERENCES negotiations(id),
    
    -- Decision details
    decision_type TEXT NOT NULL CHECK (decision_type IN (
        'emergency_override', 'fairness_adjustment', 'system_policy',
        'resource_allocation', 'priority_change', 'corridor_creation'
    )),
    proposal JSONB NOT NULL,
    rationale TEXT NOT NULL,
    
    -- Voting configuration
    quorum_required FLOAT DEFAULT 0.7, -- 70% participation
    approval_threshold FLOAT DEFAULT 0.51, -- 51% approval
    voting_deadline TIMESTAMPTZ NOT NULL,
    
    -- Voting state
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'closed', 'passed', 'failed', 'vetoed'
    )),
    total_eligible_voters INTEGER NOT NULL,
    votes_cast INTEGER DEFAULT 0,
    
    -- Results
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    abstentions INTEGER DEFAULT 0,
    vote_details JSONB DEFAULT '{}'::jsonb,
    
    -- Implementation
    implementation_deadline TIMESTAMPTZ,
    implemented BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Binding agreements between agents
CREATE TABLE commitments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commitment_id TEXT UNIQUE NOT NULL,
    negotiation_id UUID REFERENCES negotiations(id),
    
    -- Parties involved
    committed_agent_id UUID NOT NULL REFERENCES agents(id),
    beneficiary_agent_ids UUID[] NOT NULL,
    
    -- Commitment details
    commitment_type TEXT NOT NULL CHECK (commitment_type IN (
        'route_priority', 'resource_allocation', 'time_window',
        'corridor_access', 'cooperation_agreement', 'fairness_pledge'
    )),
    commitment_data JSONB NOT NULL,
    
    -- Validity period
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Commitment state
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'active', 'fulfilled', 'violated', 'expired', 'cancelled'
    )),
    
    -- Performance tracking
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    violations INTEGER DEFAULT 0,
    fulfillment_score FLOAT DEFAULT 1.0,
    
    -- Penalties for violation
    penalty_type TEXT,
    penalty_data JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emergency response protocols
CREATE TABLE emergency_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    protocol_id TEXT UNIQUE NOT NULL,
    protocol_name TEXT NOT NULL,
    
    -- Protocol classification
    emergency_type TEXT NOT NULL CHECK (emergency_type IN (
        'medical', 'fire', 'police', 'multi_vehicle', 'natural_disaster',
        'terrorism', 'infrastructure_failure', 'mass_casualty'
    )),
    severity_level INTEGER NOT NULL CHECK (severity_level >= 1 AND severity_level <= 5),
    
    -- Activation criteria
    activation_triggers JSONB NOT NULL,
    auto_activate BOOLEAN DEFAULT false,
    
    -- Protocol steps
    response_phases JSONB NOT NULL, -- Array of phase definitions
    resource_requirements JSONB NOT NULL,
    coordination_rules JSONB NOT NULL,
    
    -- Corridor specifications
    corridor_width_meters INTEGER DEFAULT 50,
    corridor_duration_seconds INTEGER DEFAULT 600,
    vehicle_clearance_time_seconds INTEGER DEFAULT 30,
    
    -- Priority overrides
    override_normal_operations BOOLEAN DEFAULT true,
    fairness_suspension BOOLEAN DEFAULT true,
    
    -- Performance targets
    target_response_time_seconds INTEGER NOT NULL,
    target_corridor_creation_seconds INTEGER DEFAULT 60,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- Active emergency corridors
CREATE TABLE emergency_corridors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corridor_id TEXT UNIQUE NOT NULL,
    protocol_id UUID REFERENCES emergency_protocols(id),
    
    -- Emergency details
    emergency_type TEXT NOT NULL,
    emergency_vehicles UUID[] NOT NULL,
    destination GEOMETRY(Point, 4326) NOT NULL,
    
    -- Corridor geometry
    corridor_path GEOMETRY(LineString, 4326) NOT NULL,
    buffer_distance_meters INTEGER NOT NULL,
    affected_intersections TEXT[] NOT NULL,
    affected_districts TEXT[] NOT NULL,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    estimated_duration_seconds INTEGER NOT NULL,
    actual_end_time TIMESTAMPTZ,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN (
        'planning', 'activating', 'active', 'clearing', 'completed', 'cancelled'
    )),
    
    -- Coordination
    coordinating_agents UUID[] NOT NULL,
    affected_vehicles INTEGER DEFAULT 0,
    vehicles_cleared INTEGER DEFAULT 0,
    
    -- Performance
    creation_time_ms INTEGER,
    full_clearance_time_seconds INTEGER,
    emergency_travel_time_seconds INTEGER,
    
    created_by UUID NOT NULL REFERENCES agents(id)
);

-- Learning patterns from successful strategies
CREATE TABLE learning_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id TEXT UNIQUE NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'coordination_strategy', 'emergency_response', 'congestion_resolution',
        'fairness_balancing', 'negotiation_tactic', 'prediction_model'
    )),
    
    -- Pattern description
    pattern_name TEXT NOT NULL,
    description TEXT,
    discovered_by UUID REFERENCES agents(id),
    discovery_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Pattern details
    context_conditions JSONB NOT NULL, -- When to apply
    action_sequence JSONB NOT NULL, -- What to do
    expected_outcomes JSONB NOT NULL, -- Expected results
    
    -- Performance metrics
    times_applied INTEGER DEFAULT 0,
    success_rate FLOAT DEFAULT 0.0,
    average_improvement FLOAT,
    confidence_score FLOAT DEFAULT 0.5,
    
    -- Evolutionary tracking
    parent_pattern_id UUID REFERENCES learning_patterns(id),
    mutation_description TEXT,
    generation INTEGER DEFAULT 1,
    
    -- Validation
    validated BOOLEAN DEFAULT false,
    validation_runs INTEGER DEFAULT 0,
    last_validated TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fairness policies for companies
CREATE TABLE fairness_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id TEXT UNIQUE NOT NULL,
    policy_name TEXT NOT NULL,
    
    -- Policy scope
    applies_to TEXT NOT NULL CHECK (applies_to IN (
        'all_companies', 'specific_company', 'company_pair', 'district', 'intersection'
    )),
    company_names TEXT[],
    location_ids TEXT[],
    
    -- Policy rules
    policy_type TEXT NOT NULL CHECK (policy_type IN (
        'resource_quota', 'time_sharing', 'priority_rotation',
        'penalty_system', 'bonus_allocation', 'dispute_resolution'
    )),
    policy_rules JSONB NOT NULL,
    
    -- Metrics and thresholds
    measurement_metric TEXT NOT NULL,
    target_value FLOAT NOT NULL,
    tolerance_range FLOAT DEFAULT 0.1,
    measurement_window_seconds INTEGER DEFAULT 3600,
    
    -- Enforcement
    enforcement_level TEXT NOT NULL CHECK (enforcement_level IN (
        'monitoring', 'soft_enforcement', 'strict_enforcement'
    )),
    penalty_schedule JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- Gaming attempts detection and logging
CREATE TABLE gaming_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id TEXT UNIQUE NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Involved parties
    company_name TEXT NOT NULL,
    agent_ids UUID[],
    vehicle_ids TEXT[],
    
    -- Gaming details
    gaming_type TEXT NOT NULL CHECK (gaming_type IN (
        'priority_manipulation', 'false_emergency', 'quota_gaming',
        'auction_collusion', 'data_spoofing', 'resource_hoarding',
        'unfair_negotiation', 'metric_manipulation'
    )),
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    
    -- Evidence
    detection_method TEXT NOT NULL,
    evidence JSONB NOT NULL,
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Pattern analysis
    pattern_matched UUID REFERENCES learning_patterns(id),
    anomaly_scores JSONB,
    related_attempts UUID[],
    
    -- Response
    automatic_response_taken BOOLEAN DEFAULT false,
    response_actions JSONB DEFAULT '[]'::jsonb,
    penalty_applied JSONB,
    
    -- Review
    reviewed BOOLEAN DEFAULT false,
    reviewed_by TEXT,
    review_outcome TEXT,
    false_positive BOOLEAN,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_negotiations_type ON negotiations(negotiation_type);
CREATE INDEX idx_negotiations_status ON negotiations(status);
CREATE INDEX idx_negotiations_initiator ON negotiations(initiator_agent_id);
CREATE INDEX idx_negotiations_participants ON negotiations USING GIN(participant_agent_ids);

CREATE INDEX idx_consensus_status ON consensus_decisions(status);
CREATE INDEX idx_consensus_type ON consensus_decisions(decision_type);
CREATE INDEX idx_consensus_deadline ON consensus_decisions(voting_deadline);

CREATE INDEX idx_commitments_agent ON commitments(committed_agent_id);
CREATE INDEX idx_commitments_status ON commitments(status);
CREATE INDEX idx_commitments_type ON commitments(commitment_type);
CREATE INDEX idx_commitments_expires ON commitments(expires_at);

CREATE INDEX idx_emergency_protocols_type ON emergency_protocols(emergency_type);
CREATE INDEX idx_emergency_protocols_active ON emergency_protocols(is_active);

CREATE INDEX idx_emergency_corridors_status ON emergency_corridors(status);
CREATE INDEX idx_emergency_corridors_path ON emergency_corridors USING GIST(corridor_path);
CREATE INDEX idx_emergency_corridors_destination ON emergency_corridors USING GIST(destination);

CREATE INDEX idx_learning_patterns_type ON learning_patterns(pattern_type);
CREATE INDEX idx_learning_patterns_active ON learning_patterns(is_active);
CREATE INDEX idx_learning_patterns_confidence ON learning_patterns(confidence_score DESC);

CREATE INDEX idx_fairness_policies_type ON fairness_policies(policy_type);
CREATE INDEX idx_fairness_policies_active ON fairness_policies(is_active);
CREATE INDEX idx_fairness_policies_company ON fairness_policies USING GIN(company_names);

CREATE INDEX idx_gaming_attempts_company ON gaming_attempts(company_name);
CREATE INDEX idx_gaming_attempts_type ON gaming_attempts(gaming_type);
CREATE INDEX idx_gaming_attempts_severity ON gaming_attempts(severity DESC);
CREATE INDEX idx_gaming_attempts_time ON gaming_attempts(detected_at DESC);

-- Enable Row Level Security
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_corridors ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairness_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (abbreviated for space, following same pattern)
-- Read policies
CREATE POLICY "Enable read access for all" ON negotiations FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON consensus_decisions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON commitments FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON emergency_protocols FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON emergency_corridors FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON learning_patterns FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON fairness_policies FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON gaming_attempts FOR SELECT USING (true);

-- Insert policies
CREATE POLICY "Enable insert for all" ON negotiations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON consensus_decisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON commitments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON emergency_protocols FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON emergency_corridors FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON learning_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON fairness_policies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON gaming_attempts FOR INSERT WITH CHECK (true);

-- Update policies
CREATE POLICY "Enable update for all" ON negotiations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON consensus_decisions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON commitments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON emergency_protocols FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON emergency_corridors FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON learning_patterns FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON fairness_policies FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON gaming_attempts FOR UPDATE USING (true) WITH CHECK (true);

-- Delete policies
CREATE POLICY "Enable delete for all" ON negotiations FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON consensus_decisions FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON commitments FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON emergency_protocols FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON emergency_corridors FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON learning_patterns FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON fairness_policies FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON gaming_attempts FOR DELETE USING (true);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE negotiations;
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_corridors;
ALTER PUBLICATION supabase_realtime ADD TABLE gaming_attempts;

-- Insert default emergency protocols
INSERT INTO emergency_protocols (protocol_id, protocol_name, emergency_type, severity_level, 
    activation_triggers, response_phases, resource_requirements, coordination_rules, 
    target_response_time_seconds, created_by)
VALUES 
    ('medical_emergency_v1', 'Medical Emergency Response', 'medical', 4,
     '{"vehicle_request": true, "severity": "critical"}',
     '[{"phase": 1, "action": "create_corridor"}, {"phase": 2, "action": "clear_route"}]',
     '{"min_agents": 3, "corridor_width": 100}',
     '{"priority": "absolute", "override_all": true}',
     240, 'system'),
    
    ('fire_response_v1', 'Fire Emergency Response', 'fire', 5,
     '{"dispatch_alert": true, "location_type": "building"}',
     '[{"phase": 1, "action": "multi_corridor"}, {"phase": 2, "action": "establish_perimeter"}]',
     '{"min_agents": 5, "corridor_width": 150}',
     '{"priority": "absolute", "multi_vehicle": true}',
     180, 'system');

-- Insert default fairness policies
INSERT INTO fairness_policies (policy_id, policy_name, applies_to, policy_type, 
    policy_rules, measurement_metric, target_value, enforcement_level, created_by)
VALUES 
    ('equal_access_v1', 'Equal Access Policy', 'all_companies', 'resource_quota',
     '{"min_share": 0.25, "max_share": 0.40}',
     'intersection_access_rate', 0.33, 'strict_enforcement', 'system'),
     
    ('anti_gaming_v1', 'Anti-Gaming Policy', 'all_companies', 'penalty_system',
     '{"penalty_multiplier": 2.0, "suspension_threshold": 3}',
     'gaming_attempt_rate', 0.0, 'strict_enforcement', 'system');
