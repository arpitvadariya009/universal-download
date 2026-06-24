import Downloader from "@/components/Downloader/Downloader";

export default function Home() {
  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "20px"
    }}>
      <Downloader />

      {/* SEO Content / FAQ Section */}
      <section style={{ 
        marginTop: "80px", 
        maxWidth: "1000px", 
        width: "100%",
        padding: "40px"
      }} className="glass-card animate-fade-in">
        <h2 style={{ marginBottom: "30px", fontSize: "2rem", textAlign: "center" }} className="gradient-text">Frequently Asked Questions</h2>
        
        <div style={{ display: "grid", gap: "24px" }}>
          <div>
            <h4 style={{ color: "var(--primary)", marginBottom: "8px" }}>Is DharitriX Downloader free to use?</h4>
            <p style={{ opacity: 0.7, fontSize: "0.95rem" }}>Yes, DharitriX Infotech provides this service 100% free of charge. You can download unlimited videos without any subscription.</p>
          </div>
          <hr style={{ opacity: 0.1 }} />
          <div>
            <h4 style={{ color: "var(--primary)", marginBottom: "8px" }}>Which platforms are supported?</h4>
            <p style={{ opacity: 0.7, fontSize: "0.95rem" }}>We support 1000+ platforms including YouTube, Instagram (Reels & Stories), TikTok (No Watermark), Facebook, Twitter, and Pinterest.</p>
          </div>
          <hr style={{ opacity: 0.1 }} />
          <div>
            <h4 style={{ color: "var(--primary)", marginBottom: "8px" }}>Why is it faster than other downloaders?</h4>
            <p style={{ opacity: 0.7, fontSize: "0.95rem" }}>Our "Instant Stream" technology pipes data directly from the source to your device, bypassing slow server-side compression steps.</p>
          </div>
          <hr style={{ opacity: 0.1 }} />
          <div>
            <h4 style={{ color: "var(--primary)", marginBottom: "8px" }}>Can I download 4K and 1080p videos?</h4>
            <p style={{ opacity: 0.7, fontSize: "0.95rem" }}>Yes! Simply select the desired quality from the resolution dropdown after the video info is fetched.</p>
          </div>
        </div>
      </section>

      <section style={{ 
        marginTop: "40px", 
        maxWidth: "1000px", 
        width: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "30px",
        padding: "40px"
      }} className="glass-card">
        <div>
          <h3 style={{ marginBottom: "10px", color: "#6366f1" }}>Fast & Secure</h3>
          <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>Our servers process your requests instantly with industrial-grade encryption.</p>
        </div>
        <div>
          <h3 style={{ marginBottom: "10px", color: "#a855f7" }}>Universal Support</h3>
          <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>Download from YouTube, Instagram, Facebook, TikTok, and 1000+ other sites.</p>
        </div>
        <div>
          <h3 style={{ marginBottom: "10px", color: "#3b82f6" }}>High Quality</h3>
          <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>Get videos in up to 4K resolution and high-bitrate MP3 audio formats.</p>
        </div>
      </section>

      <footer style={{ marginTop: "60px", opacity: 0.5, fontSize: "0.8rem" }}>
        © 2026 DharitriX Infotech. Premium Experience.
      </footer>
    </main>
  );
}
