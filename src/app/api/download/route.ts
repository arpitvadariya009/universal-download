import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { create } from "yt-dlp-exec";
import { jobs, Job, cleanOldJobsAndFiles } from "./jobs";

const isWin = process.platform === "win32";
const binaryPath = path.join(process.cwd(), "node_modules", "yt-dlp-exec", "bin", isWin ? "yt-dlp.exe" : "yt-dlp");

let ffmpegPath = "";
try {
  const ffmpeg = require("@ffmpeg-installer/ffmpeg");
  ffmpegPath = ffmpeg.path;
} catch (e) {
  const platform = process.platform;
  const arch = process.arch;
  const binaryName = isWin ? "ffmpeg.exe" : "ffmpeg";
  ffmpegPath = path.join(
    process.cwd(),
    "node_modules",
    "@ffmpeg-installer",
    `${platform}-${arch}`,
    binaryName
  );
}

const ytdlp = create(binaryPath);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const format = searchParams.get("format") || "mp4";
  const formatId = searchParams.get("formatId");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Detect and handle Terabox URLs
  const isTerabox = /terabox|terasharelink|terashare|1024tera|teraboxcdn|nephobox|freeterabox|teraboxapp/i.test(url);
  if (isTerabox) {
    try {
      console.log(`[download] Processing Terabox download for URL: ${url}`);
      const apiBase = "https://terabridge.vercel.app";
      const resolveUrl = `${apiBase}/api/resolve?url=${encodeURIComponent(url)}&key=supercloudkey`;

      const res = await fetch(resolveUrl);
      if (!res.ok) {
        throw new Error(`Terabox API returned status ${res.status}`);
      }
      const json = await res.json();
      if (json.status !== "success" || !json.files || !json.files.length) {
        throw new Error(json.message || "Failed to resolve Terabox link");
      }

      const fileData = json.files[0];
      const dlink = fileData.dlink || fileData.download_link;
      if (!dlink) {
        throw new Error("Direct download link not found in Terabox response");
      }

      console.log(`[download] Terabox resolved direct link: ${dlink}`);

      const streamResponse = await fetch(dlink, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
          "Referer": "https://www.terabox.com/"
        }
      });

      if (!streamResponse.ok) {
        throw new Error(`Failed to stream from Terabox link. Status: ${streamResponse.status}`);
      }

      const contentLength = streamResponse.headers.get("content-length");
      const contentType = streamResponse.headers.get("content-type") || "application/octet-stream";
      const filename = fileData.filename || `terabox_${Date.now()}.mp4`;

      const headers = new Headers();
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
      headers.set("Content-Type", contentType);
      if (contentLength) {
        headers.set("Content-Length", contentLength);
      }
      headers.set("Cache-Control", "no-cache");

      return new Response(streamResponse.body, { headers });
    } catch (error: any) {
      console.error("[download] Terabox download error:", error);
      return NextResponse.json({ error: "Download failed", details: error.message }, { status: 500 });
    }
  }

  const tmpDir = path.join(process.cwd(), "tmp_downloads");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const ext = format === "mp3" ? "mp3" : "mp4";
  const tmpFile = path.join(tmpDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);

  try {
    let origin = "https://www.google.com";
    try {
      origin = new URL(url).origin;
    } catch (e) {}

    // OPTIMIZATION: If downloading MP4 and we have a formatId, try to stream directly from CDN.
    // This bypasses downloading the entire file to the server first, making it "Instant"!
    if (format === "mp4" && formatId) {
      console.log(`[download] Checking if format ${formatId} can be streamed directly...`);
      try {
        const info = await ytdlp(url, {
          dumpJson: true,
          noWarnings: true,
          noCheckCertificate: true,
          noPlaylist: true,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
          addHeader: [
            `Referer:${url}`,
            `Origin:${origin}`,
            "Sec-Fetch-Site:same-origin",
          ],
          forceIpv4: true,
          retries: 10,
          retrySleep: 5,
          socketTimeout: 120, 
          extractorRetries: 5,
        } as any) as any;

        const selectedFormatObj = info.formats?.find((f: any) => f.format_id === formatId);
        if (selectedFormatObj && selectedFormatObj.vcodec !== "none" && selectedFormatObj.acodec !== "none" && selectedFormatObj.url) {
          console.log(`[download] Streaming directly from CDN: ${selectedFormatObj.url}`);
          
          const streamResponse = await fetch(selectedFormatObj.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
              "Referer": url,
              "Origin": origin,
            }
          });

          if (streamResponse.ok) {
            const contentLength = streamResponse.headers.get("content-length");
            const contentType = streamResponse.headers.get("content-type") || "video/mp4";
            
            // Generate a clean user-friendly filename from the video title
            const cleanTitle = (info.title || "video")
              .replace(/[^a-zA-Z0-9]/g, "_")
              .replace(/__+/g, "_")
              .slice(0, 50);
            const filename = `${cleanTitle}_${formatId}.mp4`;

            const headers = new Headers();
            headers.set("Content-Disposition", `attachment; filename="${filename}"`);
            headers.set("Content-Type", contentType);
            if (contentLength) {
              headers.set("Content-Length", contentLength);
            }
            headers.set("Cache-Control", "no-cache");

            return new Response(streamResponse.body, { headers });
          } else {
            console.log(`[download] Direct stream response not OK: ${streamResponse.status}. Falling back to standard download.`);
          }
        } else {
          console.log(`[download] Format ${formatId} is not a direct pre-merged format or lacks a URL. Falling back to standard download.`);
        }
      } catch (directStreamError: any) {
        console.error(`[download] Direct stream attempt failed: ${directStreamError.message}. Falling back to standard download.`);
      }
    }

    const args = [
      url,
      "-o", tmpFile,
      "--no-playlist",
      "--no-warnings",
      "--no-check-certificate",
      "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "--add-header", `Referer:${url}`,
      "--add-header", `Origin:${origin}`,
      "--add-header", "Sec-Fetch-Site:same-origin",
      "--force-ipv4",
      "--retries", "10",
      "--retry-sleep", "5",
      "--socket-timeout", "120",
      "--extractor-retries", "5",
      "--ffmpeg-location", ffmpegPath,
      "-N", "5",
    ];

    if (format === "mp3") {
      args.push("-x", "--audio-format", "mp3");
    } else if (formatId) {
      args.push("-f", `${formatId}+bestaudio/best`);
      args.push("--merge-output-format", "mp4");
      args.push("--postprocessor-args", "Merger:-strict -2");
    } else {
      args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
      args.push("--merge-output-format", "mp4");
      args.push("--postprocessor-args", "Merger:-strict -2");
    }

    console.log(`[download] Starting background download for temp file: ${tmpFile}`);

    // Clean up old jobs and files first
    cleanOldJobsAndFiles();

    // Create a new background Job
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const filename = `universal_${Date.now()}.${ext}`;
    const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";

    const job: Job = {
      id: jobId,
      status: "pending",
      progress: 0,
      filePath: tmpFile,
      filename: filename,
      contentType: contentType,
      createdAt: Date.now(),
    };
    jobs.set(jobId, job);

    // Asynchronously download and merge in the background
    (async () => {
      try {
        job.status = "downloading";
        const proc = spawn(binaryPath, args, { cwd: tmpDir });
        job.process = proc;

        proc.stdout.on("data", (data) => {
          const lines = data.toString().split("\n");
          for (let line of lines) {
            line = line.trim();
            if (line.startsWith("{") && line.endsWith("}")) {
              try {
                const info = JSON.parse(line);
                if (info.percent) {
                  job.progress = parseFloat(info.percent.replace("%", "").trim()) || job.progress;
                }
                if (info.speed) {
                  job.speed = info.speed.trim();
                }
                if (info.eta) {
                  job.eta = info.eta.trim();
                }
              } catch (e) {
                // Ignore parse errors
              }
            } else if (line.includes("[Merger]")) {
              job.status = "merging";
              job.progress = 99;
              job.speed = "";
              job.eta = "";
            } else {
              // Fallback regex in case it outputs standard format
              const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
              if (match) {
                job.progress = parseFloat(match[1]);
              }
            }
          }
        });

        proc.stderr.on("data", (data) => {
          console.error(`[job ${jobId}] stderr:`, data.toString().trim());
        });

        const code = await new Promise<number | null>((resolve) => {
          proc.on("close", resolve);
          proc.on("error", () => resolve(-1));
        });

        if (code === 0 && fs.existsSync(tmpFile)) {
          job.status = "completed";
          job.progress = 100;
          console.log(`[job ${jobId}] Completed. File size: ${fs.statSync(tmpFile).size} bytes`);
        } else {
          job.status = "failed";
          job.error = `yt-dlp exited with code ${code}`;
          console.error(`[job ${jobId}] Failed with exit code ${code}`);
          if (fs.existsSync(tmpFile)) fs.unlink(tmpFile, () => {});
        }
      } catch (err: any) {
        job.status = "failed";
        job.error = err.message;
        console.error(`[job ${jobId}] Error:`, err.message);
        if (fs.existsSync(tmpFile)) fs.unlink(tmpFile, () => {});
      }
    })();

    return NextResponse.json({ jobId });

  } catch (error: any) {
    console.error("[download] Error starting job:", error.message);
    if (fs.existsSync(tmpFile)) fs.unlink(tmpFile, () => {});
    return NextResponse.json({ error: "Failed to initiate download job", details: error.message }, { status: 500 });
  }
}
