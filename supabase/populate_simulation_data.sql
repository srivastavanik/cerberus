-- Populate Vehicle States with realistic San Francisco data
INSERT INTO vehicle_states (vehicle_id, company, status, grid_position, battery_level, passenger_count, anonymized_data, timestamp)
SELECT 
    'veh-' || generate_series || '-' || company,
    company,
    (ARRAY['idle', 'enroute', 'charging', 'picking_up'])[floor(random() * 4 + 1)],
    ST_SetSRID(ST_MakePoint(
        -122.4194 + (random() - 0.5) * 0.15, -- SF longitude range
        37.7749 + (random() - 0.5) * 0.1     -- SF latitude range
    ), 4326),
    floor(random() * 60 + 40)::int, -- battery 40-100%
    floor(random() * 4)::int, -- 0-3 passengers
    jsonb_build_object(
        'district', (ARRAY['financial', 'soma', 'mission', 'castro', 'richmond', 'sunset', 'marina', 'chinatown'])[floor(random() * 8 + 1)],
        'wait_time', floor(random() * 300)::int,
        'trip_id', 'trip-' || generate_series
    ),
    NOW() - INTERVAL '5 minutes' + (random() * INTERVAL '10 minutes')
FROM generate_series(1, 50),
     (VALUES ('waymo'), ('zoox'), ('cruise')) AS t(company);

-- Generate historical patterns
INSERT INTO historical_patterns (pattern_id, pattern_type, pattern_category, time_of_day_start, time_of_day_end, days_of_week, location_context, pattern_strength, confidence_score, occurrences, signature_data, reliability_score, is_active)
VALUES 
    ('pattern-rush-morning', 'congestion_spike', 'daily_traffic', '07:00', '09:00', ARRAY[1,2,3,4,5], 
     jsonb_build_object('districts', ARRAY['financial', 'soma'], 'severity', 'high'),
     0.85, 0.9, 250, 
     jsonb_build_object('avg_congestion', 0.8, 'avg_vehicles', 300, 'hotspot_districts', jsonb_build_object('financial', 0.9, 'soma', 0.85)),
     0.88, true),
    ('pattern-rush-evening', 'congestion_spike', 'daily_traffic', '17:00', '19:00', ARRAY[1,2,3,4,5],
     jsonb_build_object('districts', ARRAY['financial', 'soma', 'mission'], 'severity', 'high'),
     0.9, 0.92, 248,
     jsonb_build_object('avg_congestion', 0.85, 'avg_vehicles', 350, 'hotspot_districts', jsonb_build_object('financial', 0.95, 'soma', 0.9, 'mission', 0.8)),
     0.91, true),
    ('pattern-weekend-low', 'low_traffic', 'weekly_pattern', '00:00', '23:59', ARRAY[0,6],
     jsonb_build_object('city_wide', true),
     0.7, 0.85, 100,
     jsonb_build_object('avg_congestion', 0.3, 'avg_vehicles', 150),
     0.82, true);

-- Populate learning patterns from successful coordinations
INSERT INTO learning_patterns (pattern_id, pattern_type, context_conditions, successful_actions, outcome_metrics, confidence_score, usage_count, is_active)
VALUES
    ('learn-intersection-optimization', 'coordination_strategy', 
     jsonb_build_object('min_congestion', 0.7, 'intersection_type', 'high_traffic'),
     jsonb_build_object('action', 'adaptive_signal_timing', 'parameters', jsonb_build_object('green_extension', 10, 'cycle_adjustment', -5)),
     jsonb_build_object('wait_time_reduction', 0.25, 'throughput_increase', 0.15),
     0.82, 45, true),
    ('learn-fleet-rebalancing', 'congestion_resolution',
     jsonb_build_object('vehicle_imbalance', true, 'threshold', 0.3),
     jsonb_build_object('action', 'proactive_redistribution', 'vehicle_count', 10),
     jsonb_build_object('congestion_reduction', 0.2, 'response_time_improvement', 0.3),
     0.78, 32, true);

-- System metrics tracking
INSERT INTO system_metrics (total_vehicles, coordinations_per_minute, average_wait_reduction, fairness_score, district_congestion_levels, timestamp)
VALUES 
    (150, 12.5, 0.35, 0.92, jsonb_build_object('financial', 0.7, 'soma', 0.65, 'mission', 0.5, 'castro', 0.3), NOW() - INTERVAL '10 minutes'),
    (165, 14.2, 0.38, 0.89, jsonb_build_object('financial', 0.75, 'soma', 0.7, 'mission', 0.55, 'castro', 0.35), NOW() - INTERVAL '5 minutes'),
    (158, 13.8, 0.36, 0.91, jsonb_build_object('financial', 0.72, 'soma', 0.68, 'mission', 0.52, 'castro', 0.32), NOW());

-- Traffic predictions
INSERT INTO traffic_predictions (prediction_id, prediction_type, scope_type, scope_id, prediction_start, prediction_end, predictions, model_name, model_version, confidence_score, actual_outcome)
VALUES
    ('pred-001', 'congestion_level', 'district', 'financial', NOW(), NOW() + INTERVAL '1 hour',
     jsonb_build_object('expectedCongestion', 0.8, 'expectedVehicleCount', 45, 'confidenceInterval', jsonb_build_object('lower', 0.7, 'upper', 0.9)),
     'pattern_based_v1', '1.0.0', 0.85, NULL),
    ('pred-002', 'traffic_flow', 'city_wide', 'san_francisco', NOW(), NOW() + INTERVAL '30 minutes',
     jsonb_build_object('expectedFlow', 'moderate', 'hotspots', ARRAY['financial', 'soma'], 'recommendations', ARRAY['increase_capacity', 'reroute_traffic']),
     'neural_network_v2', '2.1.0', 0.78, NULL);

-- Bottleneck analysis
INSERT INTO bottleneck_analysis (analysis_id, bottleneck_type, severity, primary_location, affected_districts, affected_intersections, root_causes, recommended_actions, priority_score, estimated_impact, vehicles_affected, average_delay_seconds, timestamp)
VALUES
    ('bottleneck-001', 'intersection_congestion', 8, ST_SetSRID(ST_MakePoint(-122.4194, 37.7880), 4326),
     ARRAY['financial'], ARRAY['montgomery-market', 'montgomery-california'],
     jsonb_build_object('signal_timing', 'suboptimal', 'vehicle_density', 'high', 'pedestrian_traffic', 'heavy'),
     jsonb_build_object('immediate', ARRAY['adjust_signal_timing', 'reroute_traffic'], 'long_term', ARRAY['infrastructure_upgrade']),
     7.5, jsonb_build_object('congestion_reduction', 0.3, 'flow_improvement', 0.25),
     35, 180, NOW() - INTERVAL '15 minutes');

-- Emergency protocols
INSERT INTO emergency_protocols (protocol_id, protocol_name, emergency_type, activation_conditions, response_actions, corridor_width_meters, corridor_duration_seconds, vehicle_clearance_time_seconds, priority_level, coordination_requirements, override_permissions, is_active)
VALUES
    ('proto-001', 'Ambulance Corridor', 'medical_emergency',
     jsonb_build_object('trigger', 'ambulance_dispatch', 'severity', 'critical'),
     jsonb_build_object('create_corridor', true, 'clear_intersections', true, 'notify_vehicles', true),
     100, 600, 30, 1000,
     jsonb_build_object('required_agents', ARRAY['master', 'district', 'intersection'], 'coordination_type', 'immediate'),
     jsonb_build_object('traffic_signals', true, 'vehicle_routing', true),
     true),
    ('proto-002', 'Fire Response', 'fire_emergency',
     jsonb_build_object('trigger', 'fire_dispatch', 'severity', 'high'),
     jsonb_build_object('create_corridor', true, 'block_areas', true, 'mass_reroute', true),
     150, 1800, 45, 950,
     jsonb_build_object('required_agents', ARRAY['master', 'district', 'fleet'], 'coordination_type', 'immediate'),
     jsonb_build_object('traffic_signals', true, 'district_access', true),
     true);

-- System anomalies for monitoring
INSERT INTO system_anomalies (anomaly_id, anomaly_type, severity, affected_systems, detection_method, anomaly_score, anomaly_signature, baseline_comparison, recommended_actions, timestamp)
VALUES
    ('anomaly-001', 'coordination_degradation', 6, ARRAY['fleet_coordination', 'intersection_management'],
     'statistical_deviation', 0.72,
     jsonb_build_object('metric', 'coordination_success_rate', 'current', 0.65, 'expected', 0.92),
     jsonb_build_object('baseline_mean', 0.92, 'current_value', 0.65, 'std_deviation', 0.05),
     jsonb_build_object('investigate_cause', true, 'increase_monitoring', true),
     NOW() - INTERVAL '30 minutes');

-- Consensus decisions
INSERT INTO consensus_decisions (decision_id, decision_type, proposing_agent, participating_agents, proposal_details, voting_results, final_decision, consensus_percentage, implementation_status, timestamp)
VALUES
    ('consensus-001', 'load_balancing', 'master-orchestrator',
     ARRAY['district-financial', 'district-soma', 'fleet-waymo', 'fleet-cruise'],
     jsonb_build_object('action', 'redistribute_vehicles', 'from_district', 'financial', 'to_district', 'mission', 'vehicle_count', 15),
     jsonb_build_object('district-financial', 'approve', 'district-soma', 'approve', 'fleet-waymo', 'approve', 'fleet-cruise', 'abstain'),
     'approved', 0.75, 'completed',
     NOW() - INTERVAL '20 minutes');

-- Decision audit trail
INSERT INTO decision_audit_trail (audit_id, decision_id, agent_id, decision_type, decision_summary, input_data, decision_rationale, alternative_options, affected_entities, compliance_rules_checked, compliance_passed, performance_impact, timestamp)
VALUES
    ('audit-001', 'decision-001', 'master-orchestrator', 'traffic_optimization',
     'Reroute 20 vehicles from congested financial district',
     jsonb_build_object('congestion_level', 0.85, 'vehicle_count', 65, 'wait_times', jsonb_build_object('avg', 240, 'max', 480)),
     'High congestion detected, alternative routes available with 40% less traffic',
     jsonb_build_object('option1', 'wait_for_natural_dispersal', 'option2', 'temporary_lane_restrictions'),
     jsonb_build_object('vehicles', 20, 'districts', ARRAY['financial', 'soma']),
     ARRAY['fairness_policy', 'safety_regulations', 'efficiency_targets'],
     true,
     jsonb_build_object('expected_wait_reduction', 0.35, 'congestion_improvement', 0.25),
     NOW() - INTERVAL '25 minutes');

-- Performance benchmarks
INSERT INTO performance_benchmarks (benchmark_id, metric_name, target_value, current_value, measurement_period, achievement_status, trend_direction, notes, timestamp)
VALUES
    ('bench-001', 'average_wait_time', 120, 156, 'hourly', 'below_target', 'improving',
     'Morning rush hour impact', NOW()),
    ('bench-002', 'coordination_success_rate', 0.9, 0.87, 'daily', 'near_target', 'stable',
     'Within acceptable range', NOW()),
    ('bench-003', 'fairness_index', 0.85, 0.92, 'daily', 'above_target', 'stable',
     'Excellent fairness maintained', NOW());

-- Simulation states for scenarios
INSERT INTO simulation_states (simulation_id, scenario_id, current_step, simulation_speed, vehicle_positions, traffic_conditions, active_events, metrics_snapshot, is_paused, timestamp)
VALUES
    ('sim-001', 'scenario-rush-hour', 150, 1.0,
     jsonb_build_object('vehicles', jsonb_build_array(
         jsonb_build_object('id', 'veh-001', 'position', ARRAY[-122.4194, 37.7749], 'status', 'enroute'),
         jsonb_build_object('id', 'veh-002', 'position', ARRAY[-122.4056, 37.7785], 'status', 'idle')
     )),
     jsonb_build_object('overall', 'heavy', 'by_district', jsonb_build_object('financial', 'congested', 'soma', 'moderate')),
     jsonb_build_array('rush_hour_peak', 'intersection_optimization'),
     jsonb_build_object('total_vehicles', 150, 'avg_speed', 15, 'coordination_rate', 12.5),
     false, NOW());
