import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { getTwilioAccountSid, getTwilioAuthToken, getTwilioFromPhoneNumber, getTwilioApiKey, getTwilioApiKeySecret } from "./twilio";
import { TranscriptionService } from "./transcription";
import axios from "axios";

// Utility: safe XML escaping for TwiML
const xml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Optional PIN configuration
const PIN_SPEAKER = process.env.PIN_SPEAKER;
const PIN_PRODUCER = process.env.PIN_PRODUCER;

// Dashboard password configuration
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

// Track conference participants - store both active set and peak count
const conferenceParticipants = new Map<string, { active: Set<string>; peak: number; phoneNumbers: Set<string> }>();

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  if (req.session?.authenticated) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();
  const transcriptionService = new TranscriptionService();

  // POST /api/login - Dashboard authentication
  app.post("/api/login", (req, res) => {
    const { password } = req.body;
    
    // If no password is configured, allow access
    if (!DASHBOARD_PASSWORD) {
      req.session.authenticated = true;
      return req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Session save failed" });
        }
        res.json({ success: true });
      });
    }
    
    if (password === DASHBOARD_PASSWORD) {
      req.session.authenticated = true;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Session save failed" });
        }
        res.json({ success: true });
      });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  // POST /api/logout - Clear session
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  // GET /api/auth-status - Check if authenticated
  app.get("/api/auth-status", (req, res) => {
    res.json({ 
      authenticated: req.session?.authenticated || false,
      passwordRequired: !!DASHBOARD_PASSWORD
    });
  });

  // GET /api/twilio-info - Get Twilio phone number (protected)
  app.get("/api/twilio-info", requireAuth, async (req, res) => {
    try {
      const phoneNumber = await getTwilioFromPhoneNumber();
      res.json({ phoneNumber });
    } catch (error) {
      console.error("Error fetching Twilio info:", error);
      res.status(500).json({ error: "Failed to fetch Twilio information" });
    }
  });

  // GET /api/recordings - List all recordings (protected)
  app.get("/api/recordings", requireAuth, async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const recordings = await storage.getAllRecordings(includeArchived);
      res.json(recordings);
    } catch (error) {
      console.error("Error fetching recordings:", error);
      res.status(500).json({ error: "Failed to fetch recordings" });
    }
  });

  // POST /api/recordings/:id/archive - Archive a recording (protected)
  app.post("/api/recordings/:id/archive", requireAuth, async (req, res) => {
    try {
      await storage.archiveRecording(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving recording:", error);
      res.status(500).json({ error: "Failed to archive recording" });
    }
  });

  // POST /api/recordings/:id/unarchive - Unarchive a recording (protected)
  app.post("/api/recordings/:id/unarchive", requireAuth, async (req, res) => {
    try {
      await storage.unarchiveRecording(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unarchiving recording:", error);
      res.status(500).json({ error: "Failed to unarchive recording" });
    }
  });

  // GET /objects/:objectPath - Serve recording files (protected)
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // POST /voice - Inbound call webhook from Twilio
  app.post("/voice", (req, res) => {
    try {
      // Get the base URL from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || req.headers['x-forwarded-host'];
      const baseUrl = `${protocol}://${host}`;
      
      console.log("Incoming call to /voice", { protocol, host, baseUrl });
      
      // PIN functionality commented out for now
      // const usePin = !!(PIN_SPEAKER || PIN_PRODUCER);
      // if (usePin) {
      //   const twiml = `
      // <Response>
      //   <Say voice="Polly.Matthew-Neural">This call is recorded. By continuing, you consent to recording.</Say>
      //   <Gather input="dtmf" timeout="6" numDigits="4" action="/check-pin">
      //     <Say>Enter your four digit PIN, then press pound.</Say>
      //   </Gather>
      //   <Say>No input received. Goodbye.</Say>
      //   <Hangup/>
      // </Response>`;
      //   res.type("text/xml").send(twiml);
      //   return;
      // }

      // Customize this greeting message as needed
      const greetingMessage = "Welcome to Smiling and Dialing. This is the Operator. You are making a collect call. Please stand by on the line while I connect you to Big Fella and Kahlil.";
      
      const twiml = `
<Response>
  <Say voice="Polly.Emma-Neural">${xml(greetingMessage)}</Say>
  <Dial
    record="record-from-start"
    recordingStatusCallback="${baseUrl}/recording-callback"
    recordingStatusCallbackEvent="completed">
    <Conference
      beep="onEnter"
      maxParticipants="15"
      record="record-from-start"
      trim="do-not-trim"
      startConferenceOnEnter="true"
      waitUrl=""
      statusCallback="${baseUrl}/conf-status"
      statusCallbackEvent="start end join leave mute hold"
      recordingStatusCallback="${baseUrl}/recording-callback"
      recordingStatusCallbackEvent="completed"
      recordingStatusCallbackMethod="POST">partyline</Conference>
  </Dial>
</Response>`;
      console.log("Generated TwiML with callbacks:", { baseUrl, statusCallback: `${baseUrl}/conf-status`, recordingCallback: `${baseUrl}/recording-callback` });
      res.type("text/xml").send(twiml);
    } catch (error) {
      console.error("Error in /voice webhook:", error);
      // Return a fallback TwiML response instead of crashing
      const fallbackTwiml = `
<Response>
  <Say>Welcome to the conference line. Please hold while we connect you.</Say>
  <Dial>
    <Conference>partyline</Conference>
  </Dial>
</Response>`;
      res.type("text/xml").send(fallbackTwiml);
    }
  });

  // POST /check-pin - PIN role check
  app.post("/check-pin", (req, res) => {
    try {
      // Get the base URL from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || req.headers['x-forwarded-host'];
      const baseUrl = `${protocol}://${host}`;
      
      const digits = (req.body.Digits || "").trim();
      let joinMuted = false;

      if (digits === PIN_PRODUCER) {
        joinMuted = true;
      } else if (digits === PIN_SPEAKER) {
        joinMuted = false;
      } else {
        const bad = `
<Response>
  <Say>Invalid PIN. Goodbye.</Say>
  <Hangup/>
</Response>`;
        return res.type("text/xml").send(bad);
      }

      const roleMsg = joinMuted
        ? "Joining as a producer, you are muted on entry."
        : "Joining as a speaker.";
      const mutedAttr = joinMuted ? ` muted="true"` : ``;

      const twiml = `
<Response>
  <Say>${xml(roleMsg)}</Say>
  <Dial
    record="record-from-start"
    recordingStatusCallback="${baseUrl}/recording-callback"
    recordingStatusCallbackEvent="completed">
    <Conference
      beep="onEnter"
      maxParticipants="15"
      record="record-from-start"
      trim="do-not-trim"
      startConferenceOnEnter="true"
      waitUrl=""
      statusCallback="${baseUrl}/conf-status"
      statusCallbackEvent="start end join leave mute hold"
      recordingStatusCallback="${baseUrl}/recording-callback"
      recordingStatusCallbackEvent="completed"
      recordingStatusCallbackMethod="POST"${mutedAttr}>partyline</Conference>
  </Dial>
</Response>`;
      res.type("text/xml").send(twiml);
    } catch (error) {
      console.error("Error in /check-pin webhook:", error);
      // Return a fallback TwiML response
      const fallbackTwiml = `
<Response>
  <Say>Sorry, there was an error processing your PIN. Connecting you to the conference.</Say>
  <Dial>
    <Conference>partyline</Conference>
  </Dial>
</Response>`;
      res.type("text/xml").send(fallbackTwiml);
    }
  });

  // POST /conf-status - Conference lifecycle events
  app.post("/conf-status", (req, res) => {
    const { StatusCallbackEvent, ConferenceSid, FriendlyName, CallSid, Timestamp, From } = req.body || {};
    
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        evt: `conf.${StatusCallbackEvent}`,
        ConferenceSid,
        FriendlyName,
        CallSid,
        From,
        at: Timestamp,
      })
    );

    // Track participants for metadata (including phone numbers)
    if (ConferenceSid) {
      if (!conferenceParticipants.has(ConferenceSid)) {
        conferenceParticipants.set(ConferenceSid, { active: new Set(), peak: 0, phoneNumbers: new Set() });
      }
      
      const data = conferenceParticipants.get(ConferenceSid)!;
      
      if (StatusCallbackEvent === 'participant-join' && CallSid) {
        data.active.add(CallSid);
        data.peak = Math.max(data.peak, data.active.size);
        
        // Capture phone number from "From" field
        if (From) {
          data.phoneNumbers.add(From);
        }
      } else if (StatusCallbackEvent === 'participant-leave' && CallSid) {
        data.active.delete(CallSid);
      }
    }

    res.sendStatus(200);
  });

  // POST /recording-callback - When Twilio finalizes a recording
  app.post("/recording-callback", async (req, res) => {
    try {
      const { RecordingSid, RecordingUrl, ConferenceSid, RecordingDuration } = req.body;
      
      if (!RecordingSid || !RecordingUrl) {
        console.error("Missing recording fields", req.body);
        return res.sendStatus(400);
      }

      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        evt: "recording.callback",
        RecordingSid,
        ConferenceSid,
        duration: RecordingDuration
      }));

      // Check if this recording already exists
      const existing = await storage.getRecordingByRecordingSid(RecordingSid);
      if (existing) {
        console.log(`Recording ${RecordingSid} already processed, skipping`);
        return res.sendStatus(200);
      }

      // Download from Twilio using API Key + Secret (Replit connector auth)
      // Note: Twilio allows API Key authentication for REST API in addition to Auth Token
      const fetchUrl = `${RecordingUrl}.mp3`;
      const apiKey = await getTwilioApiKey();
      const apiKeySecret = await getTwilioApiKeySecret();

      console.log(`Downloading recording from: ${fetchUrl}`);
      console.log(`Using API Key: ${apiKey?.slice(0, 10)}...`);

      // Use axios auth parameter for proper Basic Auth + handle redirects
      const audioResp = await axios.get(fetchUrl, {
        auth: { 
          username: apiKey, 
          password: apiKeySecret 
        },
        responseType: "arraybuffer",
        validateStatus: () => true, // Handle all status codes manually
        maxRedirects: 5, // Follow redirects to media servers
        timeout: 30000,
      });

      // Check if download was successful
      if (audioResp.status < 200 || audioResp.status >= 300) {
        const errorText = Buffer.isBuffer(audioResp.data) 
          ? audioResp.data.toString('utf8') 
          : String(audioResp.data);
        console.error(`Twilio download failed (${audioResp.status}):`, errorText);
        throw new Error(`Twilio download failed: ${audioResp.status} - ${errorText.slice(0, 200)}`);
      }

      // Verify we got audio data
      const contentType = audioResp.headers['content-type'] || '';
      if (!contentType.includes('audio') && !contentType.includes('mpeg')) {
        const errorText = audioResp.data.toString('utf8');
        console.error(`Twilio returned non-audio content (${contentType}):`, errorText.slice(0, 500));
        throw new Error(`Expected audio but got: ${contentType}`);
      }

      console.log(`✅ Downloaded ${audioResp.data.byteLength} bytes (${contentType})`);

      // Upload to object storage
      const objectPath = await objectStorageService.uploadRecording(
        RecordingSid,
        audioResp.data
      );

      // Get peak participant count and phone numbers
      const confData = conferenceParticipants.get(ConferenceSid || "");
      const participantCount = confData?.peak || 0;
      const phoneNumbers = confData?.phoneNumbers ? Array.from(confData.phoneNumbers) : [];
      
      // Save recording metadata
      await storage.createRecording({
        recordingSid: RecordingSid,
        conferenceSid: ConferenceSid || null,
        objectPath,
        duration: parseInt(RecordingDuration || "0", 10),
        participants: participantCount,
        participantPhoneNumbers: phoneNumbers,
      });

      // Clean up participant tracking
      if (ConferenceSid) {
        conferenceParticipants.delete(ConferenceSid);
      }

      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        evt: "storage.upload.ok",
        RecordingSid,
        objectPath,
        participants: participantCount
      }));

      // Start transcription asynchronously (don't block the webhook response)
      if (process.env.OPENAI_API_KEY) {
        transcribeRecordingAsync(transcriptionService, RecordingSid, Buffer.from(audioResp.data)).catch(err => {
          console.error(`[Transcription] Background error for ${RecordingSid}:`, err);
        });
      }

      res.sendStatus(200);
    } catch (err: any) {
      // Try to extract meaningful error from Twilio response
      if (err?.response?.data) {
        const errorData = err.response.data;
        // If it's a Buffer (XML/JSON error), convert to string
        const errorText = Buffer.isBuffer(errorData) ? errorData.toString('utf8') : errorData;
        console.error("Recording upload error - Twilio response:", errorText);
        console.error("Response status:", err?.response?.status);
        console.error("Response headers:", err?.response?.headers);
      } else {
        console.error("Recording upload error:", err?.message || err);
      }
      // Returning 500 lets Twilio retry the webhook
      res.sendStatus(500);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Async function to transcribe recordings in the background
async function transcribeRecordingAsync(
  transcriptionService: TranscriptionService,
  recordingSid: string,
  audioBuffer: Buffer
): Promise<void> {
  try {
    // Update status to processing
    await storage.updateTranscriptionStatus(recordingSid, "processing");
    
    console.log(`[Transcription] Starting for ${recordingSid}`);
    
    const transcriptionText = await transcriptionService.transcribeRecording(audioBuffer);
    
    // Update with completed transcription
    await storage.updateTranscriptionStatus(recordingSid, "completed", transcriptionText);
    
    console.log(`[Transcription] Completed for ${recordingSid}`);
  } catch (error) {
    console.error(`[Transcription] Failed for ${recordingSid}:`, error);
    await storage.updateTranscriptionStatus(recordingSid, "failed");
  }
}
