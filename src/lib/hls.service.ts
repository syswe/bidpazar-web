import { spawn, ChildProcess } from 'child_process';
import { createWriteStream, ensureDir } from 'fs-extra';
import path from 'path';
import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';

interface HLSPipeline {
  ffmpegProcess: ChildProcess;
  outputPath: string;
}

const hlsPipelines = new Map<string, HLSPipeline>();

export async function startHLSPipeline(streamId: string, rtpPort: number): Promise<void> {
  try {
    const outputPath = path.join(process.cwd(), 'public', 'hls', streamId);
    await ensureDir(outputPath);

    const ffmpegArgs = [
      '-protocol_whitelist', 'file,udp,rtp',
      '-i', `rtp://127.0.0.1:${rtpPort}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '3',
      '-hls_flags', 'delete_segments+independent_segments',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(outputPath, 'segment_%03d.ts'),
      path.join(outputPath, 'index.m3u8')
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`[HLS] FFmpeg output for stream ${streamId}:`, data.toString());
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`[HLS] FFmpeg process for stream ${streamId} exited with code ${code}`);
      hlsPipelines.delete(streamId);
    });

    hlsPipelines.set(streamId, { ffmpegProcess, outputPath });
    console.log(`[HLS] Started pipeline for stream ${streamId}`);
  } catch (error) {
    console.error(`[HLS] Failed to start pipeline for stream ${streamId}:`, error);
    throw error;
  }
}

export function stopHLSPipeline(streamId: string): void {
  const pipeline = hlsPipelines.get(streamId);
  if (pipeline) {
    pipeline.ffmpegProcess.kill();
    hlsPipelines.delete(streamId);
    console.log(`[HLS] Stopped pipeline for stream ${streamId}`);
  }
}

export async function getHLSStream(streamId: string): Promise<NextResponse> {
  const pipeline = hlsPipelines.get(streamId);
  if (!pipeline) {
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  }

  const playlistPath = path.join(pipeline.outputPath, 'index.m3u8');
  try {
    const stream = createReadStream(playlistPath);
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`[HLS] Failed to serve stream ${streamId}:`, error);
    return NextResponse.json({ error: 'Failed to serve stream' }, { status: 500 });
  }
} 