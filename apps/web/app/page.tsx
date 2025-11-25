"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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
        return `${baseClass} bg-emerald-600 text-white`;
      case "error":
        return `${baseClass} bg-red-600 text-white`;
      default:
        return `${baseClass} bg-slate-800 text-slate-200 hover:bg-slate-700`;
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold tracking-tight">URL Shortener</h1>
        <p className="mt-2 text-sm text-slate-300">
          Create short, memorable links that are easy to share
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          {/* Long URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Long URL *</label>
            <input
              required
              type="url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              placeholder="https://example.com/very/long/path/to/page"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:border-emerald-500 focus:ring-emerald-500/20 transition"
            />
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-200">
                Custom Alias <span className="text-slate-400">(max 7 chars)</span>
              </label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                maxLength={7}
                placeholder="mylink"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:border-emerald-500 focus:ring-emerald-500/20 transition"
              />
              <p className="text-xs text-slate-400">{alias.length}/7 characters</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Expires At</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:border-emerald-500 focus:ring-emerald-500/20 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Shorten URL"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4 rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-6">
            {/* Accessible status announcement region */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {copyMessage}
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Short URL:</span>
              <div className="flex items-center gap-3">
                <a
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-emerald-300 hover:text-emerald-200 transition break-all"
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
            <div className="text-xs text-slate-400">
              Code: <span className="font-mono text-emerald-300">{result.code}</span>
            </div>

            {/* QR Code Display */}
            {result.qr_url ? (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <span className="text-sm font-medium text-slate-200">QR Code:</span>
                <div className="mt-3 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.qr_url}
                    alt="QR code"
                    className="h-48 w-48 rounded-lg border border-slate-700 bg-white p-2 shadow-lg"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-slate-700 text-sm text-slate-400">
                QR code will be generated by your teammate's service...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
