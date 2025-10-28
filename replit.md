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
- **Typography:** Inter font family for UI elements, JetBrains Mono for technical details and phone numbers
- **Responsive Layout:** Mobile-first design with breakpoint at 768px
- **Audio Playback:** In-browser HTML5 Audio elements managed via React state with custom progress controls

**Recording Dashboard Features:**
- **Participant Tracking:** Displays participant count and phone numbers for each recording
  - Phone numbers shown with Phone icon in monospace font
  - Numbers displayed as comma-separated list from participantPhoneNumbers array
- **AI Transcription Display:** Collapsible transcription section for each recording
  - Uses shadcn/ui Collapsible component with FileText icon
  - Chevron icon rotates 90 degrees when expanded
  - Transcription text displayed with preserved whitespace in muted background panel
  - Only shown when transcriptionStatus === 'completed'

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
4. **IMPORTANT:** Conference recording only starts when at least 2 participants are bridged
5. When last participant leaves, Twilio finalizes recording
6. Twilio invokes `/recording-callback` with recording URL and metadata
7. Server downloads MP3 from Twilio and uploads to object storage
8. Metadata persisted to database with object storage path
9. OpenAI Whisper transcription triggered asynchronously

**TwiML Generation:** Server-side XML string construction with proper escaping utility, returns appropriate response based on PIN configuration state.

**Recording Configuration:**
- Dual recording attributes on both `<Dial>` and `<Conference>` for reliability
- `startConferenceOnEnter="true"` ensures conference starts with first participant (moderator)
- `trim="do-not-trim"` preserves full audio including silence
- Recording callbacks on both Dial and Conference levels for maximum reliability

**Critical Recording Requirements:**
- ⚠️ **Twilio Trial Accounts:** Recording incoming calls is NOT supported on trial accounts. Must upgrade to paid account.
- ⚠️ **Minimum Participants:** Conference recordings require at least 2 bridged participants. Single-participant calls will not generate recordings.
- ✅ **Paid Accounts:** Full recording functionality available with proper TwiML configuration.

### Data Storage Solutions

**Object Storage:** Replit Object Storage via Google Cloud Storage SDK
- Files organized in `/recordings` directory within private bucket
- Uses Replit sidecar authentication (external account credentials with token exchange)
- Environment variable `PRIVATE_OBJECT_DIR` points to bucket location
- Streaming downloads with cache headers (default 3600s TTL)

**Database:** PostgreSQL (Neon serverless)
- Drizzle ORM for type-safe database access
- WebSocket configuration using `ws` package for Neon serverless driver
- **DbStorage Implementation:** Production storage layer using database persistence
- **MemStorage Fallback:** In-memory storage for local development without DATABASE_URL
- Schema: Single `recordings` table with columns:
  - `id` (UUID primary key, auto-generated)
  - `recordingSid` (Twilio unique identifier, unique constraint)
  - `conferenceSid` (Twilio conference identifier, nullable)
  - `objectPath` (file location in object storage)
  - `duration` (seconds, nullable)
  - `participants` (integer count, default 0)
  - `participantPhoneNumbers` (text array, nullable - captured from Twilio "From" field on join events)
  - `archived` (integer flag: 0=active, 1=archived, default 0)
  - `transcription` (text, nullable - OpenAI Whisper output)
  - `transcriptionStatus` (text: pending/processing/completed/failed, default pending)
  - `createdAt` (timestamp)

**Storage Pattern:** Hybrid approach with database-first design
- Interface `IStorage` abstracts storage operations
- `DbStorage` implementation provides PostgreSQL persistence via Drizzle ORM
- `MemStorage` fallback for local development without DATABASE_URL
- Production uses database for recording metadata persistence across restarts

### Authentication and Authorization

**Dashboard Authentication:**
- **DASHBOARD_PASSWORD** environment variable: Shared password protecting web dashboard access
- **Session Management:** PostgreSQL-backed sessions (connect-pg-simple) with 24-hour cookie expiration
- **Login Flow:** Users must enter password at `/login` before accessing dashboard
- **Session Persistence:** Sessions stored in PostgreSQL `session` table, survive server restarts
- **Security:** httpOnly cookies, secure flag in production, session auto-created in database
- **Protected Routes:** All dashboard API endpoints require authentication:
  - `/api/recordings` - Recordings list
  - `/api/recordings/:id/archive` - Archive functionality
  - `/api/recordings/:id/unarchive` - Unarchive functionality
  - `/objects/*` - Audio file streaming
  - `/api/twilio-info` - Twilio phone number
- **Public Routes:** Twilio webhooks remain public (no auth required):
  - `/voice` - Incoming call handler
  - `/check-pin` - PIN validation
  - `/recording-callback` - Recording completion webhook

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

**OpenAI Whisper API:**
- Automatic transcription of conference recordings
- Uses `openai` npm package with Whisper-1 model
- Transcription runs asynchronously after recording upload completes
- Requires `OPENAI_API_KEY` environment variable
- Audio files written to temp directory before streaming to OpenAI API
- Transcription status tracked in database (pending→processing→completed/failed)

**Third-Party Libraries:**
- **UI Components:** Radix UI primitives (20+ component packages for accessibility)
- **Styling:** Tailwind CSS with PostCSS processing
- **Date Handling:** date-fns for temporal grouping (Today, Yesterday, This Week, etc.)
- **HTTP Client:** Axios for Twilio media downloads and OpenAI API integration
- **Form Validation:** React Hook Form with Zod resolvers (configured but not actively used)
- **AI/ML:** OpenAI SDK for Whisper transcription

**Development Tools:**
- Vite with React plugin for fast development and optimized builds
- Replit-specific plugins: runtime error modal, cartographer, dev banner
- TypeScript with strict mode and bundler module resolution
- ESBuild for server bundle compilation