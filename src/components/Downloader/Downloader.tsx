"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./Downloader.module.css";

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  formats: any[];
}

const Downloader = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobSpeed, setJobSpeed] = useState<string>("");
  const [jobEta, setJobEta] = useState<string>("");
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = (jobId: string, type: "mp4" | "mp3", info: VideoInfo) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/download/status?jobId=${jobId}`);
        if (!statusRes.ok) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setIsDownloading(null);
          setActiveJobId(null);
          localStorage.removeItem("active_download");
          return;
        }

        const statusData = await statusRes.json();
        if (statusData.status === "completed") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setJobStatus("completed");
          setJobProgress(100);

          const a = document.createElement("a");
          a.href = `/api/download/file?jobId=${jobId}`;
          a.click();

          setIsDownloading(null);
          setActiveJobId(null);
          localStorage.removeItem("active_download");
        } else if (statusData.status === "failed") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          alert(statusData.error || "Download job failed.");
          setIsDownloading(null);
          setActiveJobId(null);
          localStorage.removeItem("active_download");
        } else {
          setJobStatus(statusData.status);
          setJobProgress(statusData.progress || 0);
          setJobSpeed(statusData.speed || "");
          setJobEta(statusData.eta || "");
        }
      } catch (pollErr) {
        console.error("Polling error:", pollErr);
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsDownloading(null);
        setActiveJobId(null);
        localStorage.removeItem("active_download");
      }
    }, 1500);
  };

  useEffect(() => {
    const saved = localStorage.getItem("active_download");
    if (saved) {
      try {
        const { jobId, videoInfo: savedInfo, type, selectedFormat: savedFormat } = JSON.parse(saved);
        if (jobId && savedInfo) {
          fetch(`/api/download/status?jobId=${jobId}`)
            .then(res => res.json())
            .then(data => {
              if (data.status && data.status !== "completed" && data.status !== "failed") {
                setVideoInfo(savedInfo);
                setUrl(savedInfo.title);
                setIsDownloading(type);
                setActiveJobId(jobId);
                setJobStatus(data.status);
                setJobProgress(data.progress || 0);
                setJobSpeed(data.speed || "");
                setJobEta(data.eta || "");
                if (savedFormat) {
                  setSelectedFormat(savedFormat);
                }
                startPolling(jobId, type, savedInfo);
              } else {
                localStorage.removeItem("active_download");
              }
            })
            .catch(() => {
              localStorage.removeItem("active_download");
            });
        }
      } catch (e) {
        localStorage.removeItem("active_download");
      }
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleCancelDownload = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (activeJobId) {
      try {
        await fetch("/api/download/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: activeJobId })
        });
      } catch (e) {
        console.error("Error canceling job:", e);
      }
    }

    setIsDownloading(null);
    setActiveJobId(null);
    setJobStatus("");
    setJobProgress(0);
    setJobSpeed("");
    setJobEta("");
    localStorage.removeItem("active_download");
  };

  const handleFetchInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setVideoInfo(null);
    setSelectedFormat("");

    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (data.error) {
        alert(data.error);
      } else {
        setVideoInfo(data);
        if (data.formats && data.formats.length > 0) {
          setSelectedFormat(data.formats[0].formatId);
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Failed to fetch video information.");
    } finally {
      setLoading(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownload = async (type: "mp4" | "mp3") => {
    if (!url || isDownloading) return;
    setIsDownloading(type);
    setJobStatus("initiating");
    setJobProgress(0);

    let downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${type}`;
    if (type === "mp4" && selectedFormat) {
      downloadUrl += `&formatId=${selectedFormat}`;
    }

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Download failed" }));
        alert(err.error || "Download failed");
        setIsDownloading(null);
        return;
      }

      const contentType = response.headers.get("content-type") || "";

      // If response is JSON, it means a background job was registered
      if (contentType.includes("application/json")) {
        const { jobId } = await response.json();
        if (!jobId) {
          alert("Failed to create download job.");
          setIsDownloading(null);
          return;
        }

        setJobStatus("pending");
        setActiveJobId(jobId);

        // Store to localStorage so page refresh can resume tracking
        if (videoInfo) {
          localStorage.setItem("active_download", JSON.stringify({
            jobId,
            videoInfo,
            type,
            selectedFormat
          }));
        }

        startPolling(jobId, type, videoInfo!);

      } else {
        // Direct stream response (⚡ Instant stream)
        const blob = await response.blob();
        if (blob.size === 0) {
          alert("Download failed — server returned empty file. Please try again.");
          setIsDownloading(null);
          return;
        }

        const ext = type === "mp3" ? "mp3" : "mp4";
        const filename = `universal_${Date.now()}.${ext}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        setIsDownloading(null);
      }
    } catch (err) {
      console.error("Download error:", err);
      alert("Download failed. Check your connection and try again.");
      setIsDownloading(null);
    }
  };

  const currentFormat = videoInfo?.formats.find(f => f.formatId === selectedFormat);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `(${(mb / 1024).toFixed(1)} GB)`;
    }
    return `(${Math.round(mb)} MB)`;
  };

  return (
    <div className={styles.container}>
      <h1 className="animate-fade-in" style={{ fontSize: "3.5rem", fontWeight: "800", marginBottom: "1rem" }}>
        Universal <span className="gradient-text">Downloader</span>
      </h1>
      <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "1.2rem", marginBottom: "2rem" }}>
        Enter any video link and download in high quality MP4 or MP3.
      </p>

      <form onSubmit={handleFetchInfo} className={styles.inputWrapper}>
        <input
          type="text"
          placeholder="Paste YouTube, Instagram, TikTok, Terabox, or Snapchat link..."
          className={styles.urlInput}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit" className={styles.downloadBtn} disabled={loading}>
          {loading ? "Searching..." : "Fetch Video"}
        </button>
      </form>

      {videoInfo && (
        <div className="glass-card animate-fade-in" style={{ marginTop: "40px", padding: "32px", display: "flex", flexWrap: "wrap", gap: "32px", textAlign: "left", alignItems: "flex-start", width: "100%", position: "relative" }}>
          <img
            src={videoInfo.thumbnail}
            alt={videoInfo.title}
            style={{ width: "240px", borderRadius: "20px", objectFit: "cover", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
          />
          <div style={{ flex: 1, minWidth: "300px" }}>
            <h3 style={{ fontSize: "1.6rem", fontWeight: "700", marginBottom: "8px", lineHeight: "1.3" }}>{videoInfo.title}</h3>
            <p style={{ opacity: 0.5, fontSize: "1rem", marginBottom: "24px" }}>⏱️ Duration: {videoInfo.duration}</p>

            <div style={{ marginBottom: "28px", position: "relative" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", opacity: 0.8, marginBottom: "10px", color: "var(--primary)" }}>SELECT QUALITY</label>
              
              {/* Custom Dropdown */}
              <div 
                style={{
                  position: "relative",
                  width: "100%",
                  cursor: "pointer",
                  userSelect: "none"
                }}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div style={{
                  padding: "14px 20px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.95rem",
                  transition: "all 0.2s ease"
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span>{currentFormat ? `${currentFormat.quality} (${currentFormat.ext})` : "Select format..."}</span>
                    {currentFormat?.filesize && <span style={{ fontSize: "0.8rem", opacity: 0.5, fontWeight: "500" }}>{formatSize(currentFormat.filesize)}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {currentFormat && (
                      <span style={{ fontSize: "0.7rem", padding: "2px 7px", borderRadius: "6px", fontWeight: "600",
                        background: currentFormat.isMerged ? "rgba(34,197,94,0.15)" : "rgba(251,146,60,0.15)",
                        color: currentFormat.isMerged ? "#4ade80" : "#fb923c" }}>
                        {currentFormat.isMerged ? "⚡ Instant" : "⏳ Merging"}
                      </span>
                    )}
                    <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: isDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.3s ease", opacity: 0.6 }}>
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                </div>

                {isDropdownOpen && (
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    right: 0,
                    background: "#1a1f2e",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "14px",
                    overflow: "hidden",
                    zIndex: 100,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    backdropFilter: "blur(20px)",
                    animation: "fadeIn 0.2s ease-out"
                  }}>
                    <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                      {videoInfo.formats.map((f, i) => (
                        <div 
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFormat(f.formatId);
                            setIsDropdownOpen(false);
                          }}
                          style={{
                            padding: "12px 20px",
                            fontSize: "0.9rem",
                            borderBottom: i === videoInfo.formats.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)",
                            background: selectedFormat === f.formatId ? "rgba(99, 102, 241, 0.15)" : "transparent",
                            color: selectedFormat === f.formatId ? "var(--primary)" : "white",
                            transition: "all 0.2s ease",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = selectedFormat === f.formatId ? "rgba(99, 102, 241, 0.15)" : "transparent"}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ fontWeight: "600" }}>{f.quality} <span style={{ opacity: 0.5, fontWeight: "400" }}>({f.ext})</span></div>
                            <span style={{ 
                              fontSize: "0.65rem", 
                              padding: "2px 6px", 
                              borderRadius: "6px", 
                              fontWeight: "600",
                              background: f.isMerged ? "rgba(34,197,94,0.15)" : "rgba(251,146,60,0.15)",
                              color: f.isMerged ? "#4ade80" : "#fb923c" 
                            }}>
                              {f.isMerged ? "⚡ Instant" : "⏳ Merging"}
                            </span>
                          </div>
                          {f.filesize && <div style={{ fontSize: "0.75rem", opacity: 0.6, fontWeight: "500", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "6px" }}>{formatSize(f.filesize).replace(/[()]/g, "")}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isDownloading ? (
              <div className={styles.progressSection}>
                <div className={styles.progressBarWrapper}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${jobProgress}%` }}
                  />
                </div>
                <div className={styles.progressDetailsRow}>
                  <div className={styles.progressText}>
                    <p className={styles.progressStatus}>
                      {jobStatus === "initiating" && "Starting download..."}
                      {jobStatus === "pending" && "Adding to server queue..."}
                      {jobStatus === "downloading" && (
                        <span>
                          Downloading: {jobProgress.toFixed(1)}%
                          {jobSpeed && ` (${jobSpeed})`}
                          {jobEta && ` • ETA: ${jobEta}`}
                        </span>
                      )}
                      {jobStatus === "merging" && "Merging audio & video..."}
                    </p>
                    <p className={styles.progressSubtext}>
                      Please keep this page open.
                    </p>
                  </div>
                  <button 
                    onClick={handleCancelDownload} 
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "16px" }}>
                <button
                  onClick={() => handleDownload("mp4")}
                  className={styles.downloadBtn}
                  style={{ padding: "16px 32px", fontSize: "1rem", background: "var(--gradient-2)", flex: 1, borderRadius: "14px", fontWeight: "600" }}
                >
                  Download MP4
                </button>
                <button
                  onClick={() => handleDownload("mp3")}
                  className={styles.downloadBtn}
                  style={{ padding: "16px 32px", fontSize: "1rem", background: "var(--gradient-1)", flex: 1, borderRadius: "14px", fontWeight: "600" }}
                >
                  Download MP3
                </button>
              </div>
            )}
            <p style={{ fontSize: "0.8rem", marginTop: "16px", opacity: 0.4, fontStyle: "italic" }}>
              * Download will begin after server processes the video.
            </p>
          </div>
        </div>
      )}

      <div className={styles.platforms}>
        <div className={styles.platformIcon} title="YouTube">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
        </div>
        <div className={styles.platformIcon} title="Instagram">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
        </div>
        <div className={styles.platformIcon} title="TikTok">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.03 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.89-.23-2.74.24-.73.42-1.22 1.18-1.31 2.01-.02.26-.02.52 0 .78.08.78.47 1.5 1.08 2.01.61.49 1.37.71 2.15.62 1.2-.13 2.14-1.13 2.27-2.32.02-.29.02-.58.01-.87.01-5.37-.01-10.74 0-16.11z" /></svg>
        </div>
        <div className={styles.platformIcon} title="Facebook">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" /></svg>
        </div>
      </div>
    </div>
  );
};

export default Downloader;
