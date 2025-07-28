-- CHUNK 4: ANALYTICS, INTEGRATION & COMPLIANCE
-- ==========================================
-- Predictions, external integrations, and audit

-- Traffic predictions from ML models
CREATE TABLE traffic_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prediction scope
    prediction_type TEXT NOT NULL CHECK (prediction_type IN (
        'traffic_volume', 'congestion_level', 'travel_time',
        'incident_probability', 'demand_surge', 'optimal_route'
    )),
    scope_type TEXT NOT NULL CHECK (scope_type IN (
        'city_wide', 'district', 'intersection', 'corridor', 'zone'
    )),
    location_ids TEXT[],
    
    -- Prediction timeframe
    prediction_start TIMESTAMPTZ NOT NULL,
    prediction_end TIMESTAMPTZ NOT NULL,
    time_granularity_minutes INTEGER DEFAULT 15,
    
    -- Model information
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Predictions
    predictions JSONB NOT NULL, -- Time series predictions
    confidence_intervals JSONB, -- Upper/lower bounds
    feature_importance JSONB, -- What drove the prediction
    
    -- Accuracy tracking
    actual_values JSONB, -- Filled in after the fact
    prediction_error FLOAT,
    error_metrics JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bottleneck analysis and problem identification
CREATE TABLE bottleneck_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id TEXT UNIQUE NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Bottleneck details
    bottleneck_type TEXT NOT NULL CHECK (bottleneck_type IN (
        'intersection_congestion', 'corridor_blockage', 'district_overload',
        'coordination_failure', 'capacity_exceeded', 'system_inefficiency'
    )),
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    
    -- Location and scope
    primary_location GEOMETRY(Geometry, 4326),
    affected_area GEOMETRY(Polygon, 4326),
    affected_intersections TEXT[],
    affected_districts TEXT[],
    
    -- Root cause analysis
    root_causes JSONB NOT NULL,
    contributing_factors JSONB,
    correlation_scores JSONB,
    
    -- Impact assessment
    vehicles_affected INTEGER,
    average_delay_seconds INTEGER,
    economic_impact_estimate FLOAT,
    
    -- Recommended solutions
    recommended_actions JSONB NOT NULL,
    priority_score FLOAT,
    estimated_resolution_time INTEGER,
    
    -- Resolution tracking
    status TEXT DEFAULT 'detected' CHECK (status IN (
        'detected', 'analyzing', 'mitigating', 'resolved', 'recurring'
    )),
    mitigation_started_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_actions JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical patterns for time-series analysis
CREATE TABLE historical_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id TEXT UNIQUE NOT NULL,
    
    -- Pattern classification
    pattern_category TEXT NOT NULL CHECK (pattern_category IN (
        'daily_traffic', 'weekly_cycle', 'seasonal', 'event_driven',
        'weather_correlated', 'holiday', 'anomaly'
    )),
    pattern_name TEXT NOT NULL,
    
    -- Time characteristics
    time_of_day_start TIME,
    time_of_day_end TIME,
    days_of_week INTEGER[],
    months INTEGER[],
    
    -- Pattern metrics
    occurrence_count INTEGER DEFAULT 1,
    average_duration_minutes INTEGER,
    variability_score FLOAT,
    
    -- Pattern signature
    signature_data JSONB NOT NULL, -- Statistical signature
    feature_vector JSONB, -- Stores feature vector as JSON array (was VECTOR(256))
    correlation_factors JSONB,
    
    -- Predictive value
    prediction_accuracy FLOAT,
    lead_time_minutes INTEGER,
    reliability_score FLOAT,
    
    -- Metadata
    first_observed TIMESTAMPTZ NOT NULL,
    last_observed TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- External data source configurations
CREATE TABLE external_data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id TEXT UNIQUE NOT NULL,
    source_name TEXT NOT NULL,
    
    -- Source details
    source_type TEXT NOT NULL CHECK (source_type IN (
        'weather_api', 'transit_api', 'event_calendar', 'traffic_sensor',
        'emergency_dispatch', 'news_feed', 'social_media', 'government_data'
    )),
    provider TEXT NOT NULL,
    
    -- API configuration
    base_url TEXT NOT NULL,
    authentication_type TEXT CHECK (authentication_type IN (
        'api_key', 'oauth2', 'basic', 'custom', 'none'
    )),
    credentials_encrypted JSONB, -- Encrypted credentials
    
    -- Request configuration
    endpoints JSONB NOT NULL, -- Available endpoints
    rate_limit_per_minute INTEGER,
    timeout_seconds INTEGER DEFAULT 30,
    retry_policy JSONB,
    
    -- Data mapping
    response_format TEXT CHECK (response_format IN ('json', 'xml', 'csv', 'custom')),
    field_mappings JSONB NOT NULL, -- Map external fields to internal
    transformation_rules JSONB,
    
    -- Polling configuration
    polling_enabled BOOLEAN DEFAULT true,
    polling_interval_seconds INTEGER DEFAULT 300,
    last_polled_at TIMESTAMPTZ,
    
    -- Health monitoring
    is_active BOOLEAN DEFAULT true,
    health_check_endpoint TEXT,
    last_health_check TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decision audit trail for compliance
CREATE TABLE decision_audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Decision reference
    decision_id UUID REFERENCES agent_decisions(id),
    agent_id UUID REFERENCES agents(id),
    
    -- Audit details
    decision_type TEXT NOT NULL,
    decision_summary TEXT NOT NULL,
    
    -- Compliance checks
    compliance_rules_checked TEXT[],
    compliance_passed BOOLEAN NOT NULL,
    compliance_violations JSONB,
    
    -- Impact assessment
    affected_entities JSONB NOT NULL, -- Vehicles, companies, districts
    potential_risks JSONB,
    mitigation_applied JSONB,
    
    -- Accountability
    decision_rationale TEXT NOT NULL,
    alternative_options JSONB,
    stakeholder_impacts JSONB,
    
    -- Regulatory requirements
    regulatory_framework TEXT,
    retention_period_days INTEGER DEFAULT 2555, -- 7 years
    deletion_scheduled_for TIMESTAMPTZ,
    
    -- Metadata
    audit_tags TEXT[],
    reviewed BOOLEAN DEFAULT false,
    reviewed_by TEXT,
    review_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Human intervention tracking
CREATE TABLE human_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intervention_id TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Intervention details
    intervention_type TEXT NOT NULL CHECK (intervention_type IN (
        'decision_override', 'emergency_takeover', 'policy_adjustment',
        'system_shutdown', 'manual_routing', 'safety_intervention'
    )),
    urgency TEXT NOT NULL CHECK (urgency IN ('routine', 'urgent', 'critical')),
    
    -- Context
    triggering_event TEXT NOT NULL,
    affected_agents UUID[],
    affected_decisions UUID[],
    
    -- Operator information
    operator_id TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    authorization_level INTEGER NOT NULL,
    
    -- Intervention actions
    actions_taken JSONB NOT NULL,
    original_state JSONB NOT NULL, -- State before intervention
    modified_state JSONB NOT NULL, -- State after intervention
    
    -- Justification
    reason_code TEXT NOT NULL,
    detailed_justification TEXT NOT NULL,
    supporting_evidence JSONB,
    
    -- Impact and outcome
    immediate_impact JSONB,
    duration_seconds INTEGER,
    reversal_time TIMESTAMPTZ,
    outcome_assessment TEXT,
    
    -- Review process
    requires_review BOOLEAN DEFAULT true,
    reviewed_at TIMESTAMPTZ,
    review_outcome TEXT,
    lessons_learned TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System anomaly detection
CREATE TABLE system_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anomaly_id TEXT UNIQUE NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Anomaly classification
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN (
        'performance_degradation', 'unusual_pattern', 'security_threat',
        'data_inconsistency', 'communication_failure', 'resource_exhaustion',
        'behavioral_change', 'external_interference'
    )),
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    
    -- Detection details
    detection_method TEXT NOT NULL,
    anomaly_score FLOAT NOT NULL,
    baseline_comparison JSONB,
    
    -- Affected components
    affected_systems TEXT[],
    affected_agents UUID[],
    affected_metrics JSONB,
    
    -- Anomaly characteristics
    anomaly_signature JSONB NOT NULL,
    duration_seconds INTEGER,
    frequency INTEGER DEFAULT 1,
    
    -- Root cause analysis
    potential_causes JSONB,
    correlation_analysis JSONB,
    similar_past_anomalies UUID[],
    
    -- Response
    automatic_response TEXT,
    manual_intervention_required BOOLEAN DEFAULT false,
    mitigation_actions JSONB,
    
    -- Resolution
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'investigating', 'mitigating', 'resolved', 'false_positive'
    )),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance benchmarks and KPIs
CREATE TABLE performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    benchmark_id TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Benchmark scope
    benchmark_type TEXT NOT NULL CHECK (benchmark_type IN (
        'system_efficiency', 'coordination_success', 'response_time',
        'fairness_index', 'congestion_reduction', 'safety_metrics',
        'environmental_impact', 'economic_efficiency'
    )),
    measurement_period_start TIMESTAMPTZ NOT NULL,
    measurement_period_end TIMESTAMPTZ NOT NULL,
    
    -- Metrics
    metric_values JSONB NOT NULL,
    target_values JSONB NOT NULL,
    achievement_percentage FLOAT,
    
    -- Comparison baselines
    baseline_period_start TIMESTAMPTZ,
    baseline_period_end TIMESTAMPTZ,
    baseline_values JSONB,
    improvement_percentage FLOAT,
    
    -- Statistical measures
    mean_value FLOAT,
    median_value FLOAT,
    std_deviation FLOAT,
    percentile_95 FLOAT,
    
    -- Breakdown analysis
    breakdown_by_district JSONB,
    breakdown_by_company JSONB,
    breakdown_by_time JSONB,
    
    -- Insights
    key_findings TEXT[],
    improvement_areas TEXT[],
    success_factors TEXT[],
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_traffic_predictions_type ON traffic_predictions(prediction_type);
CREATE INDEX idx_traffic_predictions_time ON traffic_predictions(prediction_start, prediction_end);
CREATE INDEX idx_traffic_predictions_confidence ON traffic_predictions(confidence_score DESC);

CREATE INDEX idx_bottleneck_analysis_type ON bottleneck_analysis(bottleneck_type);
CREATE INDEX idx_bottleneck_analysis_severity ON bottleneck_analysis(severity DESC);
CREATE INDEX idx_bottleneck_analysis_status ON bottleneck_analysis(status);
CREATE INDEX idx_bottleneck_analysis_location ON bottleneck_analysis USING GIST(primary_location);

CREATE INDEX idx_historical_patterns_category ON historical_patterns(pattern_category);
CREATE INDEX idx_historical_patterns_active ON historical_patterns(is_active);
-- Note: Vector similarity index removed - use application-level similarity search

CREATE INDEX idx_external_sources_type ON external_data_sources(source_type);
CREATE INDEX idx_external_sources_active ON external_data_sources(is_active);

CREATE INDEX idx_audit_trail_agent ON decision_audit_trail(agent_id);
CREATE INDEX idx_audit_trail_timestamp ON decision_audit_trail(timestamp DESC);
CREATE INDEX idx_audit_trail_compliance ON decision_audit_trail(compliance_passed);

CREATE INDEX idx_human_interventions_type ON human_interventions(intervention_type);
CREATE INDEX idx_human_interventions_operator ON human_interventions(operator_id);
CREATE INDEX idx_human_interventions_urgency ON human_interventions(urgency);

CREATE INDEX idx_system_anomalies_type ON system_anomalies(anomaly_type);
CREATE INDEX idx_system_anomalies_severity ON system_anomalies(severity DESC);
CREATE INDEX idx_system_anomalies_status ON system_anomalies(status);

CREATE INDEX idx_performance_benchmarks_type ON performance_benchmarks(benchmark_type);
CREATE INDEX idx_performance_benchmarks_period ON performance_benchmarks(measurement_period_start, measurement_period_end);

-- Enable Row Level Security
ALTER TABLE traffic_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottleneck_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_benchmarks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Read policies
CREATE POLICY "Enable read access for all" ON traffic_predictions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON bottleneck_analysis FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON historical_patterns FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON external_data_sources FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON decision_audit_trail FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON human_interventions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON system_anomalies FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON performance_benchmarks FOR SELECT USING (true);

-- Insert policies
CREATE POLICY "Enable insert for all" ON traffic_predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON bottleneck_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON historical_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON external_data_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON decision_audit_trail FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON human_interventions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON system_anomalies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON performance_benchmarks FOR INSERT WITH CHECK (true);

-- Update policies
CREATE POLICY "Enable update for all" ON traffic_predictions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON bottleneck_analysis FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON historical_patterns FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON external_data_sources FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON decision_audit_trail FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON human_interventions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON system_anomalies FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON performance_benchmarks FOR UPDATE USING (true) WITH CHECK (true);

-- Delete policies
CREATE POLICY "Enable delete for all" ON traffic_predictions FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON bottleneck_analysis FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON historical_patterns FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON external_data_sources FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON decision_audit_trail FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON human_interventions FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON system_anomalies FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON performance_benchmarks FOR DELETE USING (true);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE bottleneck_analysis;
ALTER PUBLICATION supabase_realtime ADD TABLE system_anomalies;
ALTER PUBLICATION supabase_realtime ADD TABLE human_interventions;

-- Insert default external data sources
INSERT INTO external_data_sources (source_id, source_name, source_type, provider, base_url, 
    authentication_type, endpoints, field_mappings, created_at)
VALUES 
    ('weather_noaa', 'NOAA Weather API', 'weather_api', 'NOAA', 'https://api.weather.gov',
     'none', 
     '{"forecast": "/gridpoints/{office}/{gridX},{gridY}/forecast"}',
     '{"temperature": "properties.periods[0].temperature", "conditions": "properties.periods[0].shortForecast"}',
     NOW()),
     
    ('sf_events', 'SF Events Calendar', 'event_calendar', 'SF Data', 'https://data.sfgov.org',
     'api_key',
     '{"events": "/resource/events.json"}',
     '{"event_name": "name", "location": "location", "attendance": "expected_attendance"}',
     NOW());

-- Enhancements to existing tables (as separate ALTER statements)
-- Add missing columns to vehicle_states
ALTER TABLE vehicle_states 
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES agents(id),
ADD COLUMN IF NOT EXISTS current_route JSONB,
ADD COLUMN IF NOT EXISTS eta TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1;

-- Add missing columns to intersection_states
ALTER TABLE intersection_states
ADD COLUMN IF NOT EXISTS controlling_agent_id UUID REFERENCES agents(id),
ADD COLUMN IF NOT EXISTS auction_state JSONB,
ADD COLUMN IF NOT EXISTS emergency_override BOOLEAN DEFAULT false;

-- Add missing columns to district_metrics
ALTER TABLE district_metrics
ADD COLUMN IF NOT EXISTS controlling_agents UUID[],
ADD COLUMN IF NOT EXISTS active_scenarios TEXT[],
ADD COLUMN IF NOT EXISTS weather_conditions JSONB;
