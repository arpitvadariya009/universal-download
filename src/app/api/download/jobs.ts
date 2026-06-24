import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

export interface Job {
  id: string;
  status: "pending" | "downloading" | "merging" | "completed" | "failed";
  progress: number;
  filePath: string;
  filename: string;
  contentType: string;
  error?: string;
  createdAt: number;
  process?: ChildProcess;
  speed?: string;
  eta?: string;
}

const globalRef = global as any;
globalRef.downloadJobs = globalRef.downloadJobs || new Map<string, Job>();
export const jobs: Map<string, Job> = globalRef.downloadJobs;

/**
 * Clean up jobs and temporary files that are older than 1 hour.
 */
export function cleanOldJobsAndFiles() {
  try {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    // Clean up jobs map & files referenced in jobs
    for (const [id, job] of jobs.entries()) {
      if (job.createdAt < oneHourAgo) {
        if (fs.existsSync(job.filePath)) {
          fs.unlink(job.filePath, () => {});
        }
        jobs.delete(id);
        console.log(`[jobs] Cleaned up expired job ${id}`);
      }
    }

    // Clean up any remaining orphaned files in the tmp_downloads directory
    const tmpDir = path.join(process.cwd(), "tmp_downloads");
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlink(filePath, () => {});
          console.log(`[jobs] Cleaned up orphaned temp file: ${file}`);
        }
      }
    }
  } catch (err: any) {
    console.error("[jobs] Error during cleanup:", err.message);
  }
}
