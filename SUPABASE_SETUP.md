# Supabase Setup Guide for Cerberus

This guide will help you set up Supabase for the Cerberus AV coordination system.

## Quick Setup

1. **Create a Supabase Account**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up for a free account

2. **Create a New Project**
   - Click "New project"
   - Choose a project name (e.g., "cerberus-av")
   - Set a strong database password (save this!)
   - Select a region close to you
   - Click "Create new project"

3. **Get Your API Keys**
   - Once your project is created, go to Settings → API
   - You'll find:
     - **Project URL**: `https://[PROJECT_ID].supabase.co`
     - **Anon Key**: `eyJ...` (public anonymous key)
     - **Service Role Key**: `eyJ...` (secret key - keep this secure!)

4. **Update Your Environment Variables**
   - Open `.env.local` in your project
   - Replace the placeholder values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

5. **Run Database Migrations**
   - Go to the SQL Editor in Supabase dashboard
   - Run the migrations in order:
     1. First run `supabase/000_prerequisites.sql`
     2. Then run `supabase/migrations/001_agent_system_core.sql`
     3. Then run `supabase/migrations/002_scenario_simulation.sql`
     4. Then run `supabase/migrations/003_coordination_learning.sql`
     5. Finally run `supabase/migrations/004_analytics_integration_compliance.sql`

6. **Seed Initial Data (Optional)**
   - Run `supabase/seed_agents.sql` to create initial agent records
   - Run `supabase/populate_simulation_data.sql` to add test data

7. **Restart Your Development Server**
   ```bash
   npm run dev
   ```

## Troubleshooting

- **"Invalid URL" Error**: Make sure your Supabase URL starts with `https://` and ends with `.supabase.co`
- **Authentication Errors**: Verify your anon key is correct (it's a long JWT token)
- **Database Errors**: Ensure all migrations have been run in the correct order

## Running Without Supabase

The application includes a mock client that allows basic functionality without Supabase. You'll see a warning in the console, but the app will still run with limited features.

## Next Steps

Once Supabase is configured:
1. The dashboard will show live data
2. Agent simulation features will be enabled
3. Real-time coordination events will work
4. Map visualizations will display vehicle positions
