import { NextResponse } from "next/server";
import { create } from "yt-dlp-exec";
import path from "path";

// Get the absolute path to the binary dynamically depending on platform
const isWin = process.platform === "win32";
const binaryPath = path.join(process.cwd(), "node_modules", "yt-dlp-exec", "bin", isWin ? "yt-dlp.exe" : "yt-dlp");
const ytdlp = create(binaryPath);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Detect and handle Terabox URLs
  const isTerabox = /terabox|terasharelink|terashare|1024tera|teraboxcdn|nephobox|freeterabox|teraboxapp/i.test(url);
  if (isTerabox) {
    try {
      console.log("Fetching Terabox info for URL:", url);
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
      let thumbUrl = fileData.thumbnails
        ? fileData.thumbnails.url3 || fileData.thumbnails.original || Object.values(fileData.thumbnails)[0]
        : "";

      if (thumbUrl) {
        try {
          const u = new URL(thumbUrl);
          u.searchParams.delete("size");
          thumbUrl = u.toString();
        } catch (_) {}
      }

      const filename = fileData.filename || "terabox_video.mp4";
      const ext = path.extname(filename).slice(1) || "mp4";
      const sizeBytes = parseInt(fileData.size_bytes) || 0;

      return NextResponse.json({
        title: filename,
        thumbnail: thumbUrl,
        duration: "N/A",
        formats: [
          {
            ext: ext,
            quality: "Direct High-Speed Link",
            formatId: "terabox_direct",
            vcodec: "h264",
            acodec: "aac",
            isMerged: true,
            filesize: sizeBytes,
            filesizeBytes: sizeBytes,
          }
        ]
      });
    } catch (error: any) {
      console.error("Terabox info fetch error:", error);
      return NextResponse.json({
        error: "Could not fetch Terabox video info",
        details: error.message
      }, { status: 500 });
    }
  }

  try {
    let origin = "https://www.google.com";
    try {
      const urlObj = new URL(url);
      origin = urlObj.origin;
    } catch (e) {}

    console.log("Fetching info for URL:", url);
    const info = await ytdlp(url, {
      dumpJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      noPlaylist: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      addHeader: [
        `Referer:${url}`,
        `Origin:${origin}`,
        'Sec-Fetch-Site:same-origin'
      ],
      forceIpv4: true,
      retries: 10,
      retrySleep: 5,
      socketTimeout: 120, 
      extractorRetries: 5,
    } as any) as any;

    console.log("Info fetched successfully:", info.title);

    const duration = info.duration || 0;
    const allFormats: any[] = Array.isArray(info.formats) ? info.formats : [];

    // Find the best audio-only stream size to add to video-only formats
    // (because download route always merges +bestaudio)
    const audioOnlyStreams = allFormats.filter(
      (f: any) => f.vcodec === "none" && f.acodec !== "none"
    );
    const getBestAudioSize = (): number => {
      if (audioOnlyStreams.length === 0) return 0;
      // Pick the best audio stream (highest bitrate)
      const best = audioOnlyStreams.reduce((prev: any, cur: any) => {
        const prevTbr = prev.tbr || 0;
        const curTbr = cur.tbr || 0;
        return curTbr > prevTbr ? cur : prev;
      });
      let size = best.filesize || best.filesize_approx || 0;
      if (!size && best.tbr && duration) {
        size = (best.tbr * 1024 * duration) / 8;
      }
      return size;
    };
    const bestAudioSize = getBestAudioSize();

    return NextResponse.json({
      title: info.title || "Unknown Title",
      thumbnail: info.thumbnail || "",
      duration: info.duration_string || info.duration || "N/A",
      formats: allFormats
        .filter((f: any) => (f.ext === "mp4" || f.ext === "m4a" || f.ext === "webm") && (f.vcodec !== "none" || f.acodec !== "none"))
        .map((f: any) => {
          // Estimate size if missing using bitrate (tbr) and duration
          let estimatedSize = f.filesize || f.filesize_approx || null;
          if (!estimatedSize && f.tbr && duration) {
            estimatedSize = (f.tbr * 1024 * duration) / 8;
          }

          const isVideoOnly = f.vcodec !== "none" && f.acodec === "none";

          // If video-only, add best audio size because download merges +bestaudio
          const totalSize = isVideoOnly && estimatedSize
            ? estimatedSize + bestAudioSize
            : estimatedSize;

          return {
            ext: f.ext,
            quality: f.format_note || f.resolution || "Unknown",
            formatId: f.format_id,
            vcodec: f.vcodec,
            acodec: f.acodec,
            isMerged: f.vcodec !== "none" && f.acodec !== "none",
            filesize: totalSize,
            // Raw bytes for Content-Length header in download route
            filesizeBytes: totalSize ? Math.round(totalSize) : null,
          };
        })
        .filter((f: any, index: number, self: any[]) => 
          // Deduplicate based on quality and extension
          index === self.findIndex((t: any) => (
            t.quality === f.quality && t.ext === f.ext
          ))
        )
        .sort((a: any, b: any) => {
          // Prioritize pre-merged formats for "Instant" feel
          if (a.isMerged && !b.isMerged) return -1;
          if (!a.isMerged && b.isMerged) return 1;
          
          const resA = parseInt(a.quality) || 0;
          const resB = parseInt(b.quality) || 0;
          return resB - resA;
        })
        .slice(0, 15),
    });
  } catch (error: any) {
    console.error("FULL ERROR FETCHING INFO:", {
      message: error.message,
      command: error.command,
      stderr: error.stderr,
      stdout: error.stdout,
    });

    // Detect network level blocks or timeouts
    const isBlocked = error.message?.includes("Connection reset") || 
                      error.stderr?.includes("Connection reset") ||
                      error.stderr?.includes("Recv failure") ||
                      error.message?.includes("timed out") ||
                      error.stderr?.includes("timed out");

    return NextResponse.json({ 
      error: isBlocked ? "Access Denied / Timeout by Network or ISP Block" : "Could not fetch video info", 
      details: error.message 
    }, { status: 500 });
  }
}
