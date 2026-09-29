import { createFileRoute } from "@tanstack/react-router";
import { scanWallet } from "@/lib/desk.impl";

const OWNER_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ALLOWED_ORIGIN = "https://walkingyog.com";

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  return {
    ...(origin === ALLOWED_ORIGIN ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export const Route = createFileRoute("/api/wallet-scan")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, {
          status: 204,
          headers: { ...corsHeaders(request), "Access-Control-Max-Age": "600" },
        }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Ожидается JSON с полем owner." },
            { status: 400, headers: corsHeaders(request) },
          );
        }

        const owner = String(
          body && typeof body === "object" && "owner" in body
            ? (body as { owner?: unknown }).owner ?? ""
            : "",
        ).trim();

        if (!OWNER_RE.test(owner)) {
          return Response.json(
            { error: "Нужен публичный ключ Solana." },
            { status: 400, headers: corsHeaders(request) },
          );
        }

        try {
          const scan = await scanWallet(owner);
          return Response.json(scan, { headers: corsHeaders(request) });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Не удалось прочитать кошелёк." },
            { status: 502, headers: corsHeaders(request) },
          );
        }
      },
    },
  },
});
