# 🏠 Family Command Center

> **A unified operating system for the modern family** — private chat, WebRTC video calls, brain games, chore management, shared expenses, grocery lists, and a kids rewards system. All in one app, across web and mobile.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://family-command-center-taupe.vercel.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-000020?logo=expo)](https://expo.dev/)

---

## 📖 Overview

Family Command Center solves a real problem: **families have no private, purpose-built digital space**. WhatsApp mixes family with work. Google Calendar nobody updates. Zoom requires a subscription. There's no single app that handles family communication, organisation, and fun together.

This app is built for two types of users in every family:

| User | What they need | What they get |
|------|---------------|---------------|
| **Parents** | Manage the household | Chores, groceries, expenses, family overview, reward approval |
| **Kids** | Structure + motivation | Brain games, points, rewards store, redemptions |
| **Everyone** | Stay connected | Private chat, direct messages, WebRTC video calls |

---

## ✨ Features

### 🏠 Dashboard
- Personalised greeting with the family member's name
- At-a-glance overview: upcoming chores, grocery items needed, latest note
- Real-time data — updates instantly as family members make changes

### 💬 Private Family Chat
- **Family Board** — shared group channel for all family members
- **Direct Messages** — private 1-on-1 conversations
- **Photo & Video Sharing** — P2P file transfer (files never stored on server)
- **HD Video Thumbnails** — preview videos with quality status indicators
- **Attachment Queue** — handles multiple transfers without blocking
- Real-time delivery via Supabase Realtime

### 📹 WebRTC Video Calls
- Full peer-to-peer video calling — no third-party service required
- **STUN + TURN server** configuration for worldwide connectivity (works through NAT, firewalls, mobile networks)
- Cross-platform: web app ↔ mobile app calling
- Supabase Realtime used as the WebRTC signaling channel (no dedicated signaling server)
- P2P file/attachment transfer during calls

### ✅ Chores
- Create and assign chores to family members
- Mark chores as complete — triggers confetti celebration + points awarded
- Daily progress tracker (percentage complete)
- Points earned per chore visible to kids

### 🛒 Grocery / Shop
- Shared live grocery list across all devices
- Add, check off, and remove items in real time
- Accessible from both web and mobile

### 📝 Notes
- Family bulletin board for quick messages, reminders, and pinned notes
- Real-time updates — post a note, everyone sees it immediately

### 💰 Expenses / Split
- Add shared family expenses with categories
- Automatic balance calculations between family members
- Settle-up flow — see who owes whom and by how much
- Expense reports and history

### 🧠 Brain Games (32 Games)
Turn screen time into productive, rewarding activity. Games are categorised by cognitive domain:

| Category | Games |
|----------|-------|
| 🧠 **Memory** | Memory Match, Pattern Memory, N-Back, Number Memory, Simon Says |
| 🔢 **Logic** | Sudoku, 2048, Tower of Hanoi, Ball Sort, Lights Out, Water Jugs |
| 🔤 **Language** | Word Scramble, Hangman, Word Connections, Word Chain, Anagram Solver, Code Breaker |
| ⚡ **Reflex** | Whack-a-Mole, Reflex Challenge, Typing Speed, Quick Math, Dual Task |
| 🗺️ **Spatial** | Sliding Puzzle, River Crossing, Matchstick Math, Pathway Maze, Mental Rotation |

Kids earn **points for every game completed**, which feed into the Rewards system.

### 🏆 Rewards System

The full engagement loop for kids:

```
Kid completes chore  ──► Earns points
Kid plays brain game ──► Earns points
           ▼
   Browse Rewards store
           ▼
   Submit redemption request
           ▼
   Parent approves ✅ or rejects ❌
           ▼
   Kid claims real-world reward 🎉
```

Rewards are fully customisable by parents (e.g. "Movie Night = 200 pts", "Extra Screen Time = 100 pts").

### 👤 Profile & Family Management
- Google OAuth login — no manual sign-up
- Create a family group → get a unique invite code
- Others join by entering the code
- Role-based: `parent` or `kid`

---

## 🛠️ Tech Stack

### Web App (`/src`)

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime |
| Video Calls | WebRTC (STUN/TURN) |
| Deployment | Vercel |

### Mobile App (`/mobile-app`)

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo |
| Navigation | React Navigation (bottom tabs) |
| Backend | Supabase (shared with web) |
| Media | Expo AV |
| Video Calls | WebRTC (same P2P stack as web) |
| Build | EAS Build (Android APK/AAB) |

### Backend

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime channels |
| Storage | Supabase Storage (avatars) |
| RLS | Row Level Security on all tables |
| Functions | Supabase Edge Functions / RPCs |

---

## 🏗️ Architecture

### Data Isolation with Row Level Security

Every table is scoped to a `family_id`. Supabase RLS policies ensure that users from Family A can never read or write Family B's data — enforced at the **database level**, not just the app.

```sql
-- Example RLS policy (simplified)
CREATE POLICY "Users can only see their family's chores"
ON chores FOR SELECT
USING (family_id = get_my_family_id());
```

### WebRTC Signaling via Supabase Realtime

Rather than running a dedicated signaling server, Supabase Realtime channels handle the WebRTC handshake:

```
Caller                        Supabase Realtime                     Receiver
  │─── subscribe(call-channel) ──────────────────────────────────────────│
  │─── send SDP offer ──────────────────────────────────────────────────►│
  │◄── receive SDP answer ───────────────────────────────────────────────│
  │─── send ICE candidates ─────────────────────────────────────────────►│
  │◄── receive ICE candidates ───────────────────────────────────────────│
  │                                                                        │
  └──────────────── WebRTC P2P (or TURN relay) ──────────────────────────┘
                         Direct video/audio stream
```

### TURN Server for Global Connectivity

When direct P2P isn't possible (NAT, firewalls, carrier-grade NAT), a **TURN relay server** ensures calls work:
- Same-network calls → direct P2P (lowest latency)
- Cross-network calls → TURN relay (reliable worldwide)

### Database Schema (15+ tables)

```
families          profiles          family_members
chores            chore_completions
grocery_items
notes
messages          attachments
expenses          expense_splits    settlements
rewards           redemptions
game_scores
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- Google OAuth credentials (via Supabase Auth)

### Web App Setup

```bash
# Clone the repo
git clone https://github.com/bibinantony1998/family-command-center.git
cd family-command-center

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

# Run the database schema
# Go to Supabase Dashboard → SQL Editor → paste contents of schema.sql

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Mobile App Setup

```bash
cd mobile-app

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in your Supabase credentials

# Start Expo
npx expo start

# Build for Android
npx eas build --platform android
```

### Mobile Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📁 Project Structure

```
family-command-center/
├── src/                          # Web app
│   ├── components/               # Shared UI components
│   │   ├── layout/               # AppLayout, sidebar, nav
│   │   └── ui/                   # Button, Card, Input, etc.
│   ├── contexts/                 # AuthContext, CallContext (WebRTC)
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Supabase client, helpers
│   ├── pages/                    # Page components
│   │   ├── games/                # 32 brain game components
│   │   ├── Dashboard.tsx
│   │   ├── Chat.tsx
│   │   ├── Chores.tsx
│   │   ├── Groceries.tsx
│   │   ├── Expenses.tsx
│   │   ├── Rewards.tsx
│   │   └── ...
│   └── types.ts                  # Shared TypeScript types
│
├── mobile-app/                   # React Native app
│   └── src/
│       ├── components/           # Mobile UI components
│       ├── navigation/           # Tab + stack navigation
│       └── screens/              # Screen components
│           ├── games/            # Mobile brain games
│           ├── Chat/             # Chat + VideoCallScreen
│           └── ...
│
├── schema.sql                    # Full Supabase PostgreSQL schema
└── README.md
```

---

## 🔐 Security

- All data isolated by `family_id` via Supabase RLS (database-level enforcement)
- Google OAuth only — no passwords stored
- WebRTC video is peer-to-peer (or TURN-relayed) — not recorded or processed by the app
- P2P file transfer — attachments never stored on any server
- Environment variables never committed (`.env` in `.gitignore`)

---

## 👥 Contributors

- [Bibin Antony](https://github.com/bibinantony1998)
- [Sojin Antony](https://github.com/sojinantony01)

---

## 📄 License

© 2026 Bibin Antony. All Rights Reserved.

This repository is temporarily public for the [DEV Weekend Challenge](https://dev.to/challenges/weekend-2026-02-28). The source code is **not open source** and may not be copied, modified, or redistributed without explicit permission from the author.

---

*Built with ❤️ for families everywhere.*
