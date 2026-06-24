import { NextResponse } from "next/server";
import { jobs } from "../jobs";
import fs from "fs";

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = jobs.get(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Terminate child process if running
    if (job.process) {
      try {
        job.process.kill("SIGKILL");
        console.log(`[cancel] Successfully terminated process for job ${jobId}`);
      } catch (killErr: any) {
        console.error(`[cancel] Error terminating process:`, killErr.message);
      }
    }

    // Clean up temporary file from disk
    if (fs.existsSync(job.filePath)) {
      fs.unlink(job.filePath, () => {
        console.log(`[cancel] Deleted partial file: ${job.filePath}`);
      });
    }

    // Remove job from Map
    jobs.delete(jobId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[cancel] Cancel handler error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
