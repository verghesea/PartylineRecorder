import { type Recording, type InsertRecording, recordings } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, desc } from "drizzle-orm";
import ws from "ws";

// Configure WebSocket for Neon in Node.js environment
neonConfig.webSocketConstructor = ws;

export interface IStorage {
  // Recording methods
  getRecording(id: string): Promise<Recording | undefined>;
  getRecordingByRecordingSid(recordingSid: string): Promise<Recording | undefined>;
  getAllRecordings(includeArchived?: boolean): Promise<Recording[]>;
  createRecording(recording: InsertRecording): Promise<Recording>;
  updateRecordingParticipants(recordingSid: string, participants: number): Promise<void>;
  updateTranscriptionStatus(recordingSid: string, status: string, transcription?: string): Promise<void>;
  archiveRecording(id: string): Promise<void>;
  unarchiveRecording(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private recordings: Map<string, Recording>;

  constructor() {
    this.recordings = new Map();
  }

  async getRecording(id: string): Promise<Recording | undefined> {
    return this.recordings.get(id);
  }

  async getRecordingByRecordingSid(recordingSid: string): Promise<Recording | undefined> {
    return Array.from(this.recordings.values()).find(
      (recording) => recording.recordingSid === recordingSid,
    );
  }

  async getAllRecordings(includeArchived = false): Promise<Recording[]> {
    return Array.from(this.recordings.values())
      .filter(r => includeArchived || r.archived === 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createRecording(insertRecording: InsertRecording): Promise<Recording> {
    const id = randomUUID();
    const recording: Recording = {
      id,
      recordingSid: insertRecording.recordingSid,
      conferenceSid: insertRecording.conferenceSid ?? null,
      objectPath: insertRecording.objectPath,
      duration: insertRecording.duration ?? null,
      participants: insertRecording.participants ?? null,
      participantPhoneNumbers: insertRecording.participantPhoneNumbers ?? null,
      archived: 0,
      transcription: null,
      transcriptionStatus: "pending",
      createdAt: new Date(),
    };
    this.recordings.set(id, recording);
    return recording;
  }

  async updateRecordingParticipants(recordingSid: string, participants: number): Promise<void> {
    const recording = await this.getRecordingByRecordingSid(recordingSid);
    if (recording) {
      recording.participants = participants;
      this.recordings.set(recording.id, recording);
    }
  }

  async updateTranscriptionStatus(recordingSid: string, status: string, transcription?: string): Promise<void> {
    const recording = await this.getRecordingByRecordingSid(recordingSid);
    if (recording) {
      recording.transcriptionStatus = status;
      if (transcription !== undefined) {
        recording.transcription = transcription;
      }
      this.recordings.set(recording.id, recording);
    }
  }

  async archiveRecording(id: string): Promise<void> {
    const recording = await this.getRecording(id);
    if (recording) {
      recording.archived = 1;
      this.recordings.set(id, recording);
    }
  }

  async unarchiveRecording(id: string): Promise<void> {
    const recording = await this.getRecording(id);
    if (recording) {
      recording.archived = 0;
      this.recordings.set(id, recording);
    }
  }
}

export class DbStorage implements IStorage {
  private db;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool);
  }

  async getRecording(id: string): Promise<Recording | undefined> {
    const result = await this.db
      .select()
      .from(recordings)
      .where(eq(recordings.id, id))
      .limit(1);
    return result[0];
  }

  async getRecordingByRecordingSid(recordingSid: string): Promise<Recording | undefined> {
    const result = await this.db
      .select()
      .from(recordings)
      .where(eq(recordings.recordingSid, recordingSid))
      .limit(1);
    return result[0];
  }

  async getAllRecordings(includeArchived = false): Promise<Recording[]> {
    if (includeArchived) {
      return await this.db
        .select()
        .from(recordings)
        .orderBy(desc(recordings.createdAt));
    }
    return await this.db
      .select()
      .from(recordings)
      .where(eq(recordings.archived, 0))
      .orderBy(desc(recordings.createdAt));
  }

  async createRecording(insertRecording: InsertRecording): Promise<Recording> {
    const result = await this.db
      .insert(recordings)
      .values(insertRecording)
      .returning();
    return result[0];
  }

  async updateRecordingParticipants(recordingSid: string, participants: number): Promise<void> {
    await this.db
      .update(recordings)
      .set({ participants })
      .where(eq(recordings.recordingSid, recordingSid));
  }

  async updateTranscriptionStatus(recordingSid: string, status: string, transcription?: string): Promise<void> {
    const updateData: any = { transcriptionStatus: status };
    if (transcription !== undefined) {
      updateData.transcription = transcription;
    }
    await this.db
      .update(recordings)
      .set(updateData)
      .where(eq(recordings.recordingSid, recordingSid));
  }

  async archiveRecording(id: string): Promise<void> {
    await this.db
      .update(recordings)
      .set({ archived: 1 })
      .where(eq(recordings.id, id));
  }

  async unarchiveRecording(id: string): Promise<void> {
    await this.db
      .update(recordings)
      .set({ archived: 0 })
      .where(eq(recordings.id, id));
  }
}

// Use database storage in production, memory storage for development if DATABASE_URL not set
export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
