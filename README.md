# OpenWav

A self-hosted music streaming platform built as an alternative to YouTube Music. Download audio from YouTube and other platforms, stream it from your own server, and organize your library — all without third-party dependencies at runtime.

## Overview

OpenWav is a full-stack monorepo consisting of three services: a REST API backend, a React frontend, and a standalone downloader worker. The backend exposes media streaming, user management, search, and a personalized home feed. The worker consumes download jobs from a message queue, fetches audio via yt-dlp, and stores files in MinIO object storage. The frontend communicates with the backend over HTTP and WebSocket, with all player state managed client-side in Redux.

## Tech Stack

### Backend
- **Node.js** with **Express** — REST API and Socket.IO server
- **PostgreSQL** — primary data store for users, media, history, likes, playlists, and settings
- **Redis** — pub/sub for real-time download progress and session state
- **RabbitMQ** — message queue between the backend publisher and downloader worker
- **MinIO** — S3-compatible object storage for audio files and thumbnails
- **Prisma / node-pg** — database access with raw SQL for complex queries
- **node-pg-migrate** — schema migrations
- **JWT** — stateless authentication with access and refresh tokens
- **Winston** — structured logging

### Downloader Worker
- **Node.js** — standalone RabbitMQ consumer service
- **yt-dlp** — audio extraction from YouTube, SoundCloud, and other platforms
- **MinIO SDK** — uploads processed audio files to object storage
- **BullMQ** — job queue management within the worker

### Frontend
- **React 18** with **TypeScript**
- **Vite** — build tool and dev server
- **Redux Toolkit** — global state for auth and player
- **TanStack Query (React Query)** — server state, caching, and background refetching
- **React Router v6** — client-side routing with nested layouts
- **Tailwind CSS v4** — utility-first styling
- **vite-plugin-svgr** — SVG files as React components

### Infrastructure
- **Docker Compose** — orchestrates all services in development
- **Cloudflare Tunnel** — exposes the app externally without port forwarding
- **Nginx** — reverse proxy for production routing
- **Jenkins** — CI/CD pipeline for automated deploys

## Architecture

```
┌─────────────┐     HTTP/WS      ┌──────────────────┐
│   Frontend  │ ───────────────► │  Express Backend  │
│  React/Vite │                  │  :3000            │
└─────────────┘                  └────────┬──────────┘
                                          │
                    ┌─────────────────────┼──────────────────┐
                    │                     │                  │
             ┌──────▼──────┐    ┌─────────▼──────┐  ┌──────▼──────┐
             │  PostgreSQL  │    │     Redis       │  │  RabbitMQ   │
             └─────────────┘    └────────────────┘  └──────┬──────┘
                                                            │
                                                   ┌────────▼────────┐
                                                   │ Downloader Worker│
                                                   │  yt-dlp + MinIO  │
                                                   └─────────────────┘
```

When a user requests a download, the backend publishes a job to RabbitMQ. The worker picks it up, extracts metadata with `yt-dlp --dump-single-json`, downloads the audio, uploads it to MinIO, updates the database record, and publishes progress events to Redis. The backend relays those events to the frontend via Socket.IO.

Media streaming uses presigned MinIO URLs — the backend authenticates the request and redirects the client directly to MinIO, so audio bytes never pass through the Express process.

## Project Structure

```
OpenWav/
├── backend/                  Express API
│   ├── src/
│   │   ├── config/           Database, Redis, MinIO, RabbitMQ clients
│   │   ├── controllers/      Route handlers (media, auth, admin, download)
│   │   ├── middleware/        Auth, error handling, rate limiting
│   │   ├── routes/           Express router definitions
│   │   └── services/         Business logic, search, publisher
│   └── migrations/           node-pg-migrate SQL migrations
│
├── frontend/                 React + Vite SPA
│   ├── src/
│   │   ├── assets/svg/       SVG icons (imported as React components)
│   │   ├── components/       Reusable UI — player, layout, music cards, skeleton
│   │   ├── hooks/            useAudioPlayer, useMediaQueries, useSidebar
│   │   ├── routes/           Page components grouped by auth level
│   │   ├── services/         Axios API clients
│   │   └── store/            Redux slices — auth, player
│   └── public/               Static assets
│
├── services/
│   └── downloader/           Standalone RabbitMQ worker
│       └── src/
│           ├── worker.js     Main consumer loop
│           └── minio.js      Upload helpers
│
└── docker-compose.dev.yml    Development stack
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- yt-dlp installed and available on PATH

### Environment Setup

Copy `.env.dev` and fill in the values. The required variables are:

```
DATABASE_URL
JWT_SECRET / JWT_REFRESH_SECRET
MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
RABBITMQ_URL
REDIS_HOST
```

### Running in Development

Start infrastructure (PostgreSQL, Redis, RabbitMQ, MinIO):

```bash
npm run infra:up
```

Run migrations:

```bash
npm run migrate
```

Start each service in a separate terminal:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:downloader
```

The frontend is available at `http://localhost:6330` and the API at `http://localhost:3000`.

### Creating an Admin User

```bash
cd backend && node scripts/create-admin.js
```

## Key Features

- Audio streaming via presigned MinIO URLs with full range request support
- Personalized home feed with dynamic sections — keep listening, listen again, recommendations based on play history and tag overlap
- Unified search across local library and YouTube
- Real-time download progress via Socket.IO and Redis pub/sub
- Admin dashboard with user management, download queue monitoring, and global settings
- JWT authentication with refresh token rotation
- Watch progress tracking with resume support
- Horizontal card rows with scroll and arrow navigation, matching YouTube Music's UI patterns

## API Reference

All routes are prefixed with `/api/v1`.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/register` | — | Register a new user |
| POST | `/auth/login` | — | Login and receive tokens |
| GET | `/media/home/sections` | Required | Personalized home feed |
| GET | `/media` | Optional | Paginated media list |
| GET | `/media/search` | Optional | Unified local + YouTube search |
| GET | `/media/:id/stream` | Optional | Stream audio (redirects to MinIO) |
| PATCH | `/media/:id/progress` | Required | Update play progress |
| POST | `/media/:id/like` | Required | Toggle like |
| GET | `/media/user/history` | Required | Play history |
| POST | `/download` | Required | Queue a download job |
| GET | `/admin/stats` | Admin | Dashboard statistics |
| GET | `/admin/users` | Admin | User management |
| GET | `/admin/downloads` | Admin | Download task list |
| GET | `/admin/settings` | Admin | Global settings |

## License

MIT