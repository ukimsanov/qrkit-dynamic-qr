"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { QRPreview } from "@/components/qr-preview";
import { Sparkles } from "lucide-react";

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

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
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Hero Section with Gradient */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />

        <div className="relative max-w-7xl mx-auto px-8 sm:px-12 lg:px-16 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Dynamic QR Codes + Analytics</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              Shorten URLs,{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Generate QR Codes
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Create short, memorable links with beautiful QR codes. Track scans in real-time,
              update destinations dynamically, and never print again.
            </p>
          </motion.div>

          {/* Two-Column Layout: Form + QR Preview */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-7xl mx-auto">
            {/* LEFT COLUMN: Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border-2 bg-card p-8 shadow-xl">
                <h2 className="text-2xl font-bold mb-6">Create Your Link</h2>

                <form onSubmit={onSubmit} className="space-y-5">
                  {/* Long URL */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Destination URL *</label>
                    <input
                      required
                      type="url"
                      value={longUrl}
                      onChange={(e) => setLongUrl(e.target.value)}
                      placeholder="https://example.com/your/long/url"
                      className="w-full rounded-lg border bg-input px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:border-primary focus:ring-primary/20 transition"
                    />
                  </div>

                  {/* Optional Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Custom Alias{" "}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <input
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        maxLength={7}
                        pattern="^[a-zA-Z0-9\-_]+$"
                        title="Only letters, numbers, hyphens, and underscores"
                        placeholder="mylink"
                        className="w-full rounded-lg border bg-input px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:border-primary focus:ring-primary/20 transition"
                      />
                      <p className="text-xs text-muted-foreground">{alias.length}/7 characters</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Expires At{" "}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
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
                    disabled={loading || !longUrl}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? "Generating..." : "Generate Short URL + QR Code"}
                  </Button>
                </form>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Success Message */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 rounded-lg border-2 border-primary/20 bg-primary/5 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        Successfully created!
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* RIGHT COLUMN: QR Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="lg:sticky lg:top-24 h-fit"
            >
              <QRPreview
                shortUrl={result?.short_url}
                qrUrl={result?.qr_url}
                code={result?.code}
                loading={loading}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
