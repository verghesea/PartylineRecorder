import OpenAI from "openai";
import type { Readable } from "stream";
import { createReadStream } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class TranscriptionService {
  async transcribeRecording(audioBuffer: Buffer): Promise<string> {
    try {
      console.log(`[Transcription] Starting transcription (buffer size: ${audioBuffer.length})`);

      // Write buffer to temporary file
      const tempPath = join(tmpdir(), `recording-${randomUUID()}.mp3`);
      await writeFile(tempPath, audioBuffer);

      // Create readable stream from file
      const fileStream = createReadStream(tempPath);
      
      const transcription = await openai.audio.transcriptions.create({
        file: fileStream as any,
        model: "whisper-1",
        language: "en",
        response_format: "text",
      });

      console.log(`[Transcription] Completed successfully`);
      return transcription;
    } catch (error) {
      console.error("[Transcription] Error:", error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
