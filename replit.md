# Partyline Recorder

## Overview

Partyline Recorder is a Twilio-powered conference line application that enables multi-party phone conversations with automatic recording capabilities. The system allows up to 15 participants to dial into a single toll-free number, automatically records the conversation from the first participant joining until the last one leaves, and stores recordings with rich metadata in a web-accessible dashboard.

The application is built as a full-stack web application with a React frontend and Express backend, utilizing Twilio's Programmable Voice API for telephony, Replit Object Storage for audio file persistence, and PostgreSQL (via Neon) for metadata storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite bundler, shadcn/ui component library

**Design System:** Material Design-inspired approach using Tailwind CSS with custom color variables. The UI follows Linear's clean data presentation patterns combined with Notion's organized content hierarchy, prioritizing information clarity and efficient data scanning.

**Component Structure:** 
- Uses Radix UI primitives wrapped in custom shadcn/ui components for consistent styling
- Single-page application with Wouter for client-side routing
- TanStack Query for server state management with infinite stale time (manual invalidation pattern)

**Key Design Decisions:**
- **Tailwind Configuration:** Custom border radius values (.5625rem, .375rem, .1875rem) and extensive color system with HSL variables for theme support
- **Typography:** Inter font family for UI elements, JetBrains Mono for technical details
- **Responsive Layout:** Mobile-first design with breakpoint at 768px, future-ready two-column layout structure for potential transcription features
- **Audio Playback:** In-browser HTML5 Audio elements managed via React state with custom progress controls

### Backend Architecture

**Runtime:** Node.js with Express framework, TypeScript with ESM modules

**API Design:** RESTful endpoints with form-urlencoded support for Twilio webhooks:
- `GET /api/recordings` - Retrieve all recordings with metadata
- `GET /objects/:objectPath(*)` - Stream audio files from object storage
- `POST /voice` - Twilio webhook for incoming calls (serves TwiML)
- `POST /check-pin` - Optional PIN validation for role-based access
- `POST /recording-callback` - Twilio callback for completed recordings

**Conference Management:**
- Single static conference room named "partyline"
- In-memory participant tracking with Map data structure storing active participant sets and peak counts per conference
- Supports up to 15 concurrent participants (Twilio limit)
- Optional PIN-based roles: speakers (unmuted) and producers (muted)

**Recording Flow:**
1. Caller dials toll-free number → Twilio invokes `/voice` webhook
2. Server returns TwiML with consent message and conference join instruction
3. Twilio creates/joins conference with `record-from-start` enabled
4. When last participant leaves, Twilio finalizes recording
5. Twilio invokes `/recording-callback` with recording URL and metadata
6. Server downloads MP3 from Twilio and uploads to object storage
7. Metadata persisted to database with object storage path

**TwiML Generation:** Server-side XML string construction with proper escaping utility, returns appropriate response based on PIN configuration state.

### Data Storage Solutions

**Object Storage:** Replit Object Storage via Google Cloud Storage SDK
- Files organized in `/recordings` directory within private bucket
- Uses Replit sidecar authentication (external account credentials with token exchange)
- Environment variable `PRIVATE_OBJECT_DIR` points to bucket location
- Streaming downloads with cache headers (default 3600s TTL)

**Database:** PostgreSQL (Neon serverless)
- Drizzle ORM for type-safe database access
- **DbStorage Implementation:** Production storage layer using database persistence
- **MemStorage Fallback:** In-memory storage for local development without DATABASE_URL
- Schema: Single `recordings` table with columns:
  - `id` (UUID primary key, auto-generated)
  - `recordingSid` (Twilio unique identifier, unique constraint)
  - `conferenceSid` (Twilio conference identifier, nullable)
  - `objectPath` (file location in object storage)
  - `duration` (seconds, nullable)
  - `participants` (integer count, default 0)
  - `createdAt` (timestamp)

**Storage Pattern:** Hybrid approach with database-first design
- Interface `IStorage` abstracts storage operations
- `DbStorage` implementation provides PostgreSQL persistence via Drizzle ORM
- `MemStorage` fallback for local development without DATABASE_URL
- Production uses database for recording metadata persistence across restarts

### Authentication and Authorization

**No User Authentication:** Application has no user login system - web dashboard is publicly accessible

**Caller Authentication (Optional):** 
- Environment variables `PIN_SPEAKER` and `PIN_PRODUCER` enable 4-digit PIN system
- When configured, callers must enter PIN before joining conference
- PIN determines participant role (muted vs unmuted)
- If PINs not set, all callers join unmuted by default

### External Dependencies

**Twilio Programmable Voice:**
- Replit connector integration for credential management
- Credentials obtained via Replit sidecar API (`/api/v2/connection`)
- Requires: account SID, auth token, API key, API key secret, phone number
- Used for: inbound call handling, TwiML generation, conference management, recording callbacks

**Replit Object Storage:**
- Google Cloud Storage API with Replit-specific authentication
- Token exchange via sidecar endpoint (`http://127.0.0.1:1106`)
- Bucket provisioned through Replit tools interface
- Handles: recording file persistence, streaming downloads

**Neon Serverless PostgreSQL:**
- Connection via `@neondatabase/serverless` driver
- Connection string in `DATABASE_URL` environment variable
- Drizzle Kit for schema migrations (`drizzle.config.ts`)
- Migration files stored in `/migrations` directory

**Third-Party Libraries:**
- **UI Components:** Radix UI primitives (20+ component packages for accessibility)
- **Styling:** Tailwind CSS with PostCSS processing
- **Date Handling:** date-fns for temporal grouping (Today, Yesterday, This Week, etc.)
- **HTTP Client:** Axios for Twilio media downloads
- **Form Validation:** React Hook Form with Zod resolvers (configured but not actively used)

**Development Tools:**
- Vite with React plugin for fast development and optimized builds
- Replit-specific plugins: runtime error modal, cartographer, dev banner
- TypeScript with strict mode and bundler module resolution
- ESBuild for server bundle compilation