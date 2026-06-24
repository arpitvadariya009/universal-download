import { NextResponse } from "next/server";
import { jobs } from "../jobs";
import fs from "fs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found or expired" }, { status: 404 });
  }

  if (job.status !== "completed") {
    return NextResponse.json({ error: "Job is not completed yet" }, { status: 400 });
  }

  if (!fs.existsSync(job.filePath)) {
    return NextResponse.json({ error: "Physical file not found on server disk" }, { status: 404 });
  }

  const fileSize = fs.statSync(job.filePath).size;

  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename="${job.filename}"`);
  headers.set("Content-Type", job.contentType);
  headers.set("Content-Length", String(fileSize));
  headers.set("Cache-Control", "no-cache");

  // Create stream and delete file upon successful streaming or client abort
  const fileStream = new ReadableStream({
    start(controller) {
      const rs = fs.createReadStream(job.filePath);
      rs.on("data", (chunk) => controller.enqueue(chunk));
      rs.on("end", () => {
        controller.close();
        fs.unlink(job.filePath, () => {
          console.log(`[file] Temp file cleaned up after successful download stream: ${job.filePath}`);
        });
        jobs.delete(jobId);
      });
      rs.on("error", (err) => {
        controller.error(err);
        fs.unlink(job.filePath, () => {});
        jobs.delete(jobId);
      });
    },
    cancel() {
      fs.unlink(job.filePath, () => {});
      jobs.delete(jobId);
    },
  });

  return new Response(fileStream, { headers });
}
