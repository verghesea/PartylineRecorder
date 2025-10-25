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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRecordingSchema = createInsertSchema(recordings).omit({
  id: true,
  createdAt: true,
});

export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type Recording = typeof recordings.$inferSelect;
