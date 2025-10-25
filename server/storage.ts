import { type Recording, type InsertRecording } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Recording methods
  getRecording(id: string): Promise<Recording | undefined>;
  getRecordingByRecordingSid(recordingSid: string): Promise<Recording | undefined>;
  getAllRecordings(): Promise<Recording[]>;
  createRecording(recording: InsertRecording): Promise<Recording>;
  updateRecordingParticipants(recordingSid: string, participants: number): Promise<void>;
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

  async getAllRecordings(): Promise<Recording[]> {
    return Array.from(this.recordings.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createRecording(insertRecording: InsertRecording): Promise<Recording> {
    const id = randomUUID();
    const recording: Recording = {
      ...insertRecording,
      id,
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
}

export const storage = new MemStorage();
