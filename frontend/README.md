# 19wpm

A multiplayer typing test built with React, TypeScript, and Spring Boot.

## WIP

- **Touch Typing Practice Course** - planned interactive course for learning touch typing (home-row basics through full-keyboard drills) and an accompanying practice mode

## Features

- **Typing Tests** - timed (15s/30s/60s) and word-count (10/25/50/100) modes with phrases mode
- **Multiplayer Racing** - create or join private/public rooms, real-time STOMP WebSocket racing with live progress and results
- **Difficulty Levels** - EASY / MEDIUM / HARD / EXPERT word pools
- **Results & Stats** - per-test results with WPM, accuracy, mistake analysis, and personal best tracking

## Setup

```bash
VITE_API_BASE_URL=https://your-backend.com  # or omit for localhost proxy
npm install
npm run dev
```

## Tech

React, TypeScript, Vite, Tailwind CSS, React Router, STOMP over SockJS, Recharts

## Scripts

| Command          | Description                  |
|------------------|------------------------------|
| `npm run dev`    | Start dev server             |
| `npm run build`  | Type-check and build         |
| `npm run preview`| Preview production build     |
| `npm run lint`   | Run ESLint                   |
