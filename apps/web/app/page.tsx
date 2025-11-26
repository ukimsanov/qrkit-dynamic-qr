"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

type ShortenResponse = {
  code: string;
  short_url: string;
  qr_url?: string | null;
};

export default function Home() {
  const [longUrl, setLongUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShortenResponse | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [copyMessage, setCopyMessage] = useState("");
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyUrl = async () => {
    if (!result) return;

    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }

    try {
      await navigator.clipboard.writeText(result.short_url);
      setCopyStatus("copied");
      setCopyMessage("URL copied to clipboard");

      // Reset to idle after 2 seconds
      copyTimeoutRef.current = setTimeout(() => {
        setCopyStatus("idle");
        setCopyMessage("");
      }, 2000);
    } catch {
      setCopyStatus("error");
      setCopyMessage("Failed to copy URL");

      // Reset to idle after 3 seconds
      copyTimeoutRef.current = setTimeout(() => {
        setCopyStatus("idle");
        setCopyMessage("");
      }, 3000);
    }
  };

  const getCopyButtonClass = () => {
    const baseClass = "rounded-lg px-4 py-3 text-sm font-medium transition min-w-[80px]";
    switch (copyStatus) {
      case "copied":
        return `${baseClass} bg-primary text-primary-foreground`;
      case "error":
        return `${baseClass} bg-destructive text-destructive-foreground`;
      default:
        return `${baseClass} bg-secondary text-secondary-foreground hover:bg-secondary/80`;
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setCopyStatus("idle");
    setCopyMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://b.ularkimsanov.com";
      const res = await fetch(`${apiUrl}/api/shorten`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          long_url: longUrl,
          alias: alias || undefined,
          expires_at: expiresAt || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      const data = (await res.json()) as ShortenResponse;
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border shadow-xl p-8 bg-card">
        <h1 className="text-3xl font-bold tracking-tight">URL Shortener + QR Codes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create short, memorable links with dynamic QR codes and real-time analytics
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          {/* Long URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Long URL *</label>
            <input
              required
              type="url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              placeholder="https://example.com/very/long/path/to/page"
              className="w-full rounded-lg border bg-input px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:border-primary focus:ring-primary/20 transition"
            />
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm">
                Custom Alias <span className="text-muted-foreground">(max 7 chars)</span>
              </label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                maxLength={7}
                pattern="^[a-zA-Z0-9\-_]+$"
                title="Only letters, numbers, hyphens, and underscores are allowed"
                placeholder="mylink"
                className="w-full rounded-lg border bg-input px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:border-primary focus:ring-primary/20 transition"
              />
              <p className="text-xs text-muted-foreground">{alias.length}/7 characters</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm">Expires At</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border bg-input px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:border-primary focus:ring-primary/20 transition"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating..." : "Shorten URL"}
          </Button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-6">
            {/* Accessible status announcement region */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {copyMessage}
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Short URL:</span>
              <div className="flex items-center gap-3">
                <a
                  className="flex-1 rounded-lg border bg-background px-4 py-3 text-sm text-primary hover:text-primary/80 transition break-all font-medium"
                  href={result.short_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.short_url}
                </a>
                <button
                  onClick={handleCopyUrl}
                  className={getCopyButtonClass()}
                  aria-label={
                    copyStatus === "copied"
                      ? "Copied to clipboard"
                      : copyStatus === "error"
                      ? "Copy failed, try again"
                      : "Copy URL to clipboard"
                  }
                >
                  {copyStatus === "copied"
                    ? "Copied!"
                    : copyStatus === "error"
                    ? "Failed"
                    : "Copy"}
                </button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Code: <span className="font-mono text-foreground font-medium">{result.code}</span>
            </div>

            {/* Analytics Link */}
            <div className="pt-4 border-t">
              <a
                href={`/analytics/${result.code}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <BarChart3 className="h-4 w-4" />
                View Analytics Dashboard
              </a>
            </div>

            {/* QR Code Display */}
            {result.qr_url ? (
              <div className="mt-4 pt-4 border-t">
                <span className="text-sm font-medium">QR Code:</span>
                <div className="mt-3 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.qr_url}
                    alt="QR code"
                    className="h-48 w-48 rounded-lg border bg-white p-2 shadow-lg"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                QR code generated successfully
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
