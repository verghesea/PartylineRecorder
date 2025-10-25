# Partyline Recorder

A Twilio-powered multi-party conference line with automatic recording and web dashboard for playback.

## Features

- **Dial-in Conference**: Single toll-free number for up to 15 participants
- **Auto-Recording**: Records from first join to last hangup
- **Role-Based Access**: Optional 4-digit PINs for speakers (unmuted) vs producers (muted)
- **Web Dashboard**: View, play, and download all recordings with beautiful UI
- **Metadata Tracking**: Stores duration, participant count, and conference details
- **Temporal Grouping**: Organize recordings by Today, Yesterday, This Week, etc.
- **Audio Player**: In-browser playback with progress bar and seek functionality

## Setup Instructions

### 1. Twilio Configuration

1. **Connect Twilio Integration** (already connected via Replit)
2. **Configure Twilio Webhook** in your Twilio Console:
   - Go to Phone Numbers → Manage → Active Numbers
   - Select your toll-free number
   - Under "A CALL COMES IN":
     - Set to **Webhook**
     - Method: **HTTP POST**
     - URL: `https://your-repl-url.replit.app/voice`
   - Click Save

### 2. Optional: PIN-Based Roles

To enable role-based access with PINs, set these environment secrets in Replit:

```
PIN_SPEAKER=1234    # Your 4-digit PIN for speakers (unmuted)
PIN_PRODUCER=9876   # Your 4-digit PIN for producers (muted)
```

If these are not set, all callers join unmuted.

### 3. Object Storage (Already Configured)

The application uses Replit Object Storage for recording files. This is already set up with:
- Default bucket created
- Environment variables configured
- Recording storage in `/recordings` directory

## How to Use

### For Callers

1. **Dial** the toll-free number
2. **Listen** to the recording consent message
3. **(Optional)** Enter your 4-digit PIN if configured:
   - Speaker PIN: Join unmuted
   - Producer PIN: Join muted
4. **Talk** with other participants (up to 15 total)
5. **Hang up** when done

The recording starts when the first person joins and stops when the last person leaves.

### For Admins

1. **Open the web dashboard** at your Replit URL
2. **Browse recordings** organized by date
3. **Search** for specific recordings
4. **Play** recordings in-browser with progress controls
5. **Download** MP3 files for offline use

## API Endpoints

### Frontend Routes
- `GET /` - Web dashboard (recordings list)

### Twilio Webhooks
- `POST /voice` - Inbound call handler
- `POST /check-pin` - PIN verification (if PINs enabled)
- `POST /conf-status` - Conference lifecycle events
- `POST /recording-callback` - Recording completion handler

### Backend API
- `GET /api/recordings` - List all recordings (JSON)
- `GET /objects/recordings/:filename` - Serve recording audio file

## Architecture

```
Caller → Twilio Number
           ↓
       POST /voice (Express)
           ↓
    <Conference TwiML>
     (15 max, record-from-start)
           ↓
    Twilio mixes audio
           ↓
   POST /recording-callback
           ↓
  Download from Twilio → Upload to Object Storage
           ↓
     Save metadata (MemStorage)
           ↓
  Dashboard shows recording
```

## Technology Stack

- **Frontend**: React, TanStack Query, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, TypeScript
- **Telephony**: Twilio Programmable Voice
- **Storage**: Replit Object Storage (Google Cloud Storage)
- **Data**: In-memory storage (recordings metadata)

## Development

The application automatically restarts when code changes are saved. The workflow "Start application" runs:

```bash
npm run dev
```

This starts both the backend API server and the frontend development server on port 5000.

## Future Enhancements

- **Transcription**: Automatic speech-to-text using Whisper
- **Summaries**: AI-generated call summaries
- **Multi-Room**: Support for multiple simultaneous conference rooms
- **User Auth**: Protect dashboard with authentication
- **Database**: Migrate from memory to PostgreSQL for persistence
- **AWS S3**: Optional migration from Replit Object Storage to AWS S3
- **Notifications**: Email/SMS alerts when recordings are ready

## Support

For issues or questions:
- Check server logs in the Replit console
- Review Twilio Console → Monitor → Logs for call/recording issues
- Verify webhook URLs are correct and accessible

## License

MIT
