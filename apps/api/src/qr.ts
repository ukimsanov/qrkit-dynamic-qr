import { config } from "./config.js";

type QrResponse = { image?: string; mime?: string; url?: string };

export async function generateQr(data: { content: string; format?: "png" | "svg"; version?: number; ecLevel?: "L" | "M" }): Promise<{ status: "ready" | "failed"; qrUrl: string | null }> {
  if (!config.qrServiceUrl) {
    return { status: "failed", qrUrl: null };
  }
  try {
    const res = await fetch(`${config.qrServiceUrl}/qr`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: data.content,
        format: data.format ?? "png",
        version: data.version ?? 1,
        ecLevel: data.ecLevel ?? "M"
      })
    });
    if (!res.ok) {
      return { status: "failed", qrUrl: null };
    }
    const body = (await res.json()) as QrResponse;
    const qrUrl = body.url ?? null;
    return { status: qrUrl ? "ready" : "failed", qrUrl };
  } catch {
    return { status: "failed", qrUrl: null };
  }
}
