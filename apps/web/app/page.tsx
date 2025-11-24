"use client";

import { FormEvent, useState } from "react";

type ShortenResponse = { code: string; short_url: string; qr_url?: string | null };

export default function Home() {
  const [longUrl, setLongUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShortenResponse | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          long_url: longUrl,
          alias: alias || undefined,
          expires_at: expiresAt || undefined
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-50 px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">QR + URL Shortener</h1>
        <p className="mt-1 text-sm text-slate-300">
          Create a short link and get a QR code for it. Powered by the edge redirector + API.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-200">Long URL</label>
            <input
              required
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              placeholder="https://example.com/very/long/path"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:border-slate-500 focus:ring-slate-700"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Custom alias (optional)</label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="my-custom-code"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:border-slate-500 focus:ring-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Expires at (optional, ISO date)</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-transparent focus:border-slate-500 focus:ring-slate-700"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating..." : "Create short URL"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-sm text-slate-200">
              Short URL:{" "}
              <a className="text-emerald-300 hover:underline" href={result.short_url} target="_blank" rel="noreferrer">
                {result.short_url}
              </a>
            </div>
            {result.qr_url ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-slate-200">QR Code:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.qr_url} alt="QR code" className="h-40 w-40 rounded-md border border-slate-800 bg-white p-2" />
              </div>
            ) : (
              <div className="text-sm text-slate-400">QR not available yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
