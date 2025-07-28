# SF AV Coordination System

An AI-powered traffic coordination system for autonomous vehicles in San Francisco, featuring NVIDIA Nemotron integration for intelligent decision-making.

## 🚀 Overview

This system implements a multi-agent architecture to coordinate autonomous vehicles from multiple companies (Waymo, Zoox, Cruise) across San Francisco, optimizing traffic flow, reducing congestion, and ensuring fair resource allocation.

### Key Features

- **Multi-Agent System**: 22 intelligent agents including Master Orchestrator, Fleet Coordinators, Intersection Agents, and District Agents
- **AI-Powered Optimization**: NVIDIA Llama 3.3 Nemotron integration for intelligent traffic decisions
- **Real-time Coordination**: Event-driven architecture with live updates
- **Emergency Response**: Dynamic corridor creation for emergency vehicles
- **Fair Resource Allocation**: Company-neutral coordination with fairness scoring
- **Scalable Architecture**: Handles 750+ simultaneous vehicles

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL with PostGIS)
- **AI**: NVIDIA Nemotron (Llama 3.3)
- **Maps**: Mapbox GL JS
- **Real-time**: Server-Sent Events (SSE)

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account
- NVIDIA API key (optional, system works without it)
- Mapbox token (for map visualization)

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/srivastavanik/cerberus.git
cd cerberus
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your credentials:
- Add your NVIDIA API key
- Update Supabase credentials if using your own instance
- Add your Mapbox token

### 4. Set up the database

Follow the instructions in `DATABASE_SETUP.md` to configure your Supabase database with the required schema.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🧪 Testing the System

### Generate Traffic Data
```bash
curl -X POST http://localhost:3000/api/data/generate \
  -H "Content-Type: application/json" \
  -d '{"vehicleCount": 750, "scenario": "normal"}'
```

### Start Simulation
```bash
curl -X POST http://localhost:3000/api/simulation/start \
  -H "Content-Type: application/json" \
  -d '{"scenario": "rush_hour", "duration": 3600}'
```

### Start Agent System
```bash
curl -X POST http://localhost:3000/api/agents/start
```

### Monitor Real-time Events
```bash
curl http://localhost:3000/api/events/stream
```

## 📁 Project Structure

```
sf-av-coordination/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/         # API routes
│   │   ├── dashboard/   # Dashboard page
│   │   ├── districts/   # District management
│   │   ├── fleets/      # Fleet coordination
│   │   └── ...
│   ├── components/      # React components
│   └── lib/            # Core libraries
│       ├── agents/     # Multi-agent system
│       ├── nvidia.ts   # NVIDIA AI integration
│       └── supabase.ts # Database client
├── supabase/           # Database schema
├── public/             # Static assets
└── ...
```

## 🤖 Agent Architecture

1. **Master Orchestrator**: Central coordination and system-wide optimization
2. **Fleet Coordinators** (3): Company-specific vehicle management
3. **Intersection Agents** (5): Major intersection traffic flow
4. **District Agents** (12): District-level coordination

## 🔧 API Endpoints

- `POST /api/agents/start` - Start the agent system
- `POST /api/agents/stop` - Stop the agent system
- `GET /api/agents/status` - Get system status
- `POST /api/data/generate` - Generate traffic data
- `POST /api/simulation/start` - Start simulation
- `POST /api/coordination/negotiate` - Handle negotiations
- `GET /api/events/stream` - Real-time event stream

## 🚦 Simulation Scenarios

1. **Normal Traffic** - Balanced traffic flow
2. **Rush Hour** - High congestion periods
3. **Emergency** - Emergency vehicle routing
4. **Special Event** - Event traffic management

## 📊 System Metrics

- Total vehicles coordinated
- Average wait time reduction
- Fairness score across companies
- Emergency response times
- District congestion levels

## 🔒 Security

- Environment variables for sensitive data
- Row Level Security in Supabase
- Service role key for server operations
- No exposed API keys in frontend

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Known Issues

- Initial database setup required (see DATABASE_SETUP.md)
- NVIDIA API key optional but recommended for AI features

## 📞 Support

For issues or questions, please open a GitHub issue.
