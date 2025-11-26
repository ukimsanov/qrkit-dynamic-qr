"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, Check, BarChart3, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

type QRPreviewProps = {
  shortUrl?: string;
  qrUrl?: string | null;
  code?: string;
  loading?: boolean;
};

export function QRPreview({ shortUrl, qrUrl, code, loading = false }: QRPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `qr-${code || "code"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Card container with gradient border effect */}
      <div className="relative group h-full">
        {/* Animated gradient border */}
        <motion.div
          className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 opacity-0 group-hover:opacity-100 blur-sm"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            backgroundSize: "200% 100%",
          }}
        />

        {/* Main card */}
        <div className="relative h-full rounded-2xl border-2 bg-card p-8 shadow-lg">
          <AnimatePresence mode="wait">
            {/* Empty State */}
            {!loading && !qrUrl && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col items-center justify-center text-center"
              >
                {/* Animated placeholder */}
                <motion.div
                  className="relative mb-6"
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {/* QR code placeholder with grid pattern */}
                  <div className="w-48 h-48 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex items-center justify-center relative overflow-hidden">
                    {/* Animated grid background */}
                    <div className="absolute inset-0 opacity-10">
                      <svg width="100%" height="100%">
                        <pattern
                          id="grid"
                          width="20"
                          height="20"
                          patternUnits="userSpaceOnUse"
                        >
                          <rect width="20" height="20" fill="none" stroke="currentColor" strokeWidth="0.5" />
                        </pattern>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>
                    </div>

                    {/* Sparkle icon */}
                    <motion.div
                      animate={{
                        rotate: [0, 360],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Sparkles className="h-12 w-12 text-muted-foreground/40" />
                    </motion.div>
                  </div>
                </motion.div>

                <h3 className="text-lg font-semibold mb-2">QR Code Preview</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Enter a URL to generate your QR code. It will appear here instantly!
                </p>
              </motion.div>
            )}

            {/* Loading State */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col items-center justify-center"
              >
                {/* Animated spinner with gradient */}
                <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                  <motion.div
                    className="absolute inset-0 rounded-xl border-4 border-primary/30 border-t-primary"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div
                    className="absolute inset-4 rounded-lg border-4 border-accent/30 border-b-accent"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                </div>

                <p className="text-sm font-medium text-muted-foreground">
                  Generating your QR code...
                </p>
              </motion.div>
            )}

            {/* Success State - QR Code Display */}
            {!loading && qrUrl && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full flex flex-col"
              >
                {/* QR Code Image - clean and simple */}
                <div className="flex-1 flex items-center justify-center mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="w-64 h-64 rounded-xl border-2 bg-white p-4 shadow-xl"
                  />
                </div>

                {/* Short URL Display */}
                {shortUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-6"
                  >
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                      <span className="text-sm font-mono text-foreground/80 flex-1 truncate">
                        {shortUrl}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={handleCopy}
                        className="shrink-0"
                      >
                        <motion.div
                          initial={false}
                          animate={{ scale: copied ? [1, 1.2, 1] : 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </motion.div>
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <Button
                    onClick={handleDownload}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>

                  {code && (
                    <Button
                      variant="outline"
                      asChild
                      className="flex-1"
                    >
                      <a href={`/analytics/${code}`}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Analytics
                      </a>
                    </Button>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
