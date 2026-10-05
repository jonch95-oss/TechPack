"use client";

/** Last-resort boundary for the root layout: its own document, plain styles (globals.css isn't loaded here). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf8f4", color: "#1a1a1a", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <title>Tech Pack Studio</title>
        <div style={{ textAlign: "center", maxWidth: 480, padding: 24 }} role="alert">
          <h1 style={{ fontWeight: 400, fontSize: 28 }}>The studio didn&apos;t load</h1>
          <p style={{ color: "#7a7166", fontSize: 14, lineHeight: 1.6 }}>Nothing is lost — saved answers are on the server and AI jobs keep running.</p>
          <button type="button" onClick={() => retry()} style={{ marginTop: 24, padding: "10px 24px", border: "1px solid #1a1a1a", background: "transparent", letterSpacing: "0.2em", fontSize: 11, textTransform: "uppercase", cursor: "pointer" }}>
            Try again
          </button>
          {error.digest && <div style={{ marginTop: 24, fontSize: 10, color: "#aaa" }}>REF {error.digest}</div>}
        </div>
      </body>
    </html>
  );
}
