"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", background: "#fff", color: "#0f172a", padding: 48, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: "#64748b" }}>The app hit an unexpected error.</p>
        <button onClick={reset} style={{ marginTop: 16, background: "#2563eb", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px" }}>Try again</button>
      </body>
    </html>
  );
}
