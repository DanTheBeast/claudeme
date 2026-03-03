"use client";

import * as Sentry from "@sentry/capacitor";
import { useEffect } from "react";

/**
 * Next.js global error boundary — catches unhandled React render errors.
 * Sentry captures the exception; the user sees a simple recovery screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          fontFamily: "sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#FDFBF9",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <img
          src="/logo.png"
          alt="CallMe"
          style={{ width: 64, height: 64, borderRadius: 18, marginBottom: 20 }}
        />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>
          The app hit an unexpected error. We&apos;ve been notified.
        </p>
        <button
          onClick={reset}
          style={{
            background: "linear-gradient(135deg, #DE7F65, #C05840)",
            color: "white",
            border: "none",
            borderRadius: 14,
            padding: "12px 28px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
