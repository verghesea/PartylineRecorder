import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { getTwilioAccountSid, getTwilioAuthToken, getTwilioFromPhoneNumber } from "./twilio";
import { TranscriptionService } from "./transcription";
import axios from "axios";

// Utility: safe XML escaping for TwiML
const xml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Optional PIN configuration
const PIN_SPEAKER = process.env.PIN_SPEAKER;
const PIN_PRODUCER = process.env.PIN_PRODUCER;

// Track conference participants - store both active set and peak count
const conferenceParticipants = new Map<string, { active: Set<string>; peak: number }>();

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();
  const transcriptionService = new TranscriptionService();

  // GET /api/twilio-info - Get Twilio phone number
  app.get("/api/twilio-info", async (req, res) => {
    try {
      const phoneNumber = await getTwilioFromPhoneNumber();
      res.json({ phoneNumber });
    } catch (error) {
      console.error("Error fetching Twilio info:", error);
      res.status(500).json({ error: "Failed to fetch Twilio information" });
    }
  });

  // GET /api/recordings - List all recordings
  app.get("/api/recordings", async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const recordings = await storage.getAllRecordings(includeArchived);
      res.json(recordings);
    } catch (error) {
      console.error("Error fetching recordings:", error);
      res.status(500).json({ error: "Failed to fetch recordings" });
    }
  });

  // POST /api/recordings/:id/archive - Archive a recording
  app.post("/api/recordings/:id/archive", async (req, res) => {
    try {
      await storage.archiveRecording(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving recording:", error);
      res.status(500).json({ error: "Failed to archive recording" });
    }
  });

  // POST /api/recordings/:id/unarchive - Unarchive a recording
  app.post("/api/recordings/:id/unarchive", async (req, res) => {
    try {
      await storage.unarchiveRecording(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unarchiving recording:", error);
      res.status(500).json({ error: "Failed to unarchive recording" });
    }
  });

  // GET /objects/:objectPath - Serve recording files
  app.get("/objects/:objectPath(*)", async (req, res) => {
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
    // Get the base URL from the request
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || req.headers['x-forwarded-host'];
    const baseUrl = `${protocol}://${host}`;
    
    const usePin = !!(PIN_SPEAKER || PIN_PRODUCER);

    if (usePin) {
      const twiml = `
<Response>
  <Say voice="Polly.Matthew-Neural">This call is recorded. By continuing, you consent to recording.</Say>
  <Gather input="dtmf" timeout="6" numDigits="4" action="/check-pin">
    <Say>Enter your four digit PIN, then press pound.</Say>
  </Gather>
  <Say>No input received. Goodbye.</Say>
  <Hangup/>
</Response>`;
      res.type("text/xml").send(twiml);
      return;
    }

    const twiml = `
<Response>
  <Say voice="Polly.Matthew-Neural">This call is recorded. By continuing, you consent to recording.</Say>
  <Dial>
    <Conference
      beep="onEnter"
      maxParticipants="15"
      record="record-from-start"
      waitUrl=""
      statusCallback="${baseUrl}/conf-status"
      statusCallbackEvent="start end join leave mute hold"
      recordingStatusCallback="${baseUrl}/recording-callback"
      recordingStatusCallbackEvent="completed">partyline</Conference>
  </Dial>
</Response>`;
    console.log("Generated TwiML with callbacks:", { baseUrl, statusCallback: `${baseUrl}/conf-status`, recordingCallback: `${baseUrl}/recording-callback` });
    res.type("text/xml").send(twiml);
  });

  // POST /check-pin - PIN role check
  app.post("/check-pin", (req, res) => {
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
  <Dial>
    <Conference
      beep="onEnter"
      maxParticipants="15"
      record="record-from-start"
      waitUrl=""
      statusCallback="${baseUrl}/conf-status"
      statusCallbackEvent="start end join leave mute hold"
      recordingStatusCallback="${baseUrl}/recording-callback"
      recordingStatusCallbackEvent="completed"${mutedAttr}>partyline</Conference>
  </Dial>
</Response>`;
    res.type("text/xml").send(twiml);
  });

  // POST /conf-status - Conference lifecycle events
  app.post("/conf-status", (req, res) => {
    const { StatusCallbackEvent, ConferenceSid, FriendlyName, CallSid, Timestamp } = req.body || {};
    
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        evt: `conf.${StatusCallbackEvent}`,
        ConferenceSid,
        FriendlyName,
        CallSid,
        at: Timestamp,
      })
    );

    // Track participants for metadata
    if (ConferenceSid) {
      if (!conferenceParticipants.has(ConferenceSid)) {
        conferenceParticipants.set(ConferenceSid, { active: new Set(), peak: 0 });
      }
      
      const data = conferenceParticipants.get(ConferenceSid)!;
      
      if (StatusCallbackEvent === 'participant-join' && CallSid) {
        data.active.add(CallSid);
        data.peak = Math.max(data.peak, data.active.size);
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

      // Download from Twilio
      const fetchUrl = `${RecordingUrl}.mp3`;
      const accountSid = await getTwilioAccountSid();
      const authToken = await getTwilioAuthToken();
      const authStr = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const audioResp = await axios.get(fetchUrl, {
        responseType: "arraybuffer",
        headers: { Authorization: `Basic ${authStr}` },
        timeout: 30000,
      });

      // Upload to object storage
      const objectPath = await objectStorageService.uploadRecording(
        RecordingSid,
        audioResp.data
      );

      // Get peak participant count
      const participantCount = conferenceParticipants.get(ConferenceSid || "")?.peak || 0;
      
      // Save recording metadata
      await storage.createRecording({
        recordingSid: RecordingSid,
        conferenceSid: ConferenceSid || null,
        objectPath,
        duration: parseInt(RecordingDuration || "0", 10),
        participants: participantCount,
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
      console.error("Recording upload error:", err?.response?.data || err?.message || err);
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
