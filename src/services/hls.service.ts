import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

interface Stream {
  id: string;
  streamKey: string;
  status: string;
  hlsUrl?: string | null;
  hlsPlaylistPath?: string | null;
  hlsSegmentPath?: string | null;
}

export class HLSService {
  private readonly outputDir: string;
  private readonly segmentDuration: number = 4;
  private readonly segmentListSize: number = 3;
  private readonly segmentFilePattern: string = 'segment_%03d.ts';
  private readonly playlistFileName: string = 'playlist.m3u8';

  constructor() {
    this.outputDir = path.join(process.cwd(), 'public', 'hls');
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // ... rest of the file remains unchanged ...
} 