import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Recording schema - stores metadata about conference recordings
export const recordings = pgTable("recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingSid: text("recording_sid").notNull().unique(),
  conferenceSid: text("conference_sid"),
  objectPath: text("object_path").notNull(), // Path in object storage
  duration: integer("duration"), // Duration in seconds
  participants: integer("participants").default(0), // Number of participants
  participantPhoneNumbers: text("participant_phone_numbers").array(), // Array of caller phone numbers
  archived: integer("archived").default(0).notNull(), // Soft delete flag (0=active, 1=archived)
  transcription: text("transcription"), // OpenAI Whisper transcription text
  transcriptionStatus: text("transcription_status").default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Multi-track recording fields
  recordingType: text("recording_type").default("mixed"), // "mixed" | "stem"
  callSid: text("call_sid"), // For stem recordings - identifies which participant
  recordingSource: text("recording_source"), // Twilio's RecordingSource parameter
  recordingTrack: text("recording_track"), // "inbound" | "outbound" | "both"
  callerPhoneNumber: text("caller_phone_number"), // Phone number of caller (for stems)
});

export const insertRecordingSchema = createInsertSchema(recordings).omit({
  id: true,
  createdAt: true,
});

export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type Recording = typeof recordings.$inferSelect;
