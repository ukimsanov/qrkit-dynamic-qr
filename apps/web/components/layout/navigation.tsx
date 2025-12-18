"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { QrCode } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Navigation() {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-lg supports-[backdrop-filter]:bg-card/60"
      style={{
        WebkitBackdropFilter: "blur(16px)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 group relative"
          >
            {/* Animated glow effect on hover */}
            <motion.div
              className="absolute -inset-2 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 blur-xl"
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />

            {/* Logo icon with rotation animation */}
            <motion.div
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="relative"
            >
              <QrCode className="h-8 w-8 text-primary" />
            </motion.div>

            {/* Brand text - simple and clean */}
            <span className="text-xl font-bold">
              QRKit
            </span>
          </Link>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Future auth placeholders - hidden for now, ready for expansion */}
            <div className="hidden md:flex items-center gap-2">
              {/* Will be populated with Login/Sign Up buttons */}
            </div>

            {/* Theme toggle with hover effect */}
            <div className="relative z-10">
              <ThemeToggle />

              {/* Subtle ring animation on mount */}
              <motion.div
                className="absolute inset-0 rounded-md ring-2 ring-primary/20 pointer-events-none"
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom border with gradient animation */}
      <motion.div
        className="h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"
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
    </motion.nav>
  );
}
