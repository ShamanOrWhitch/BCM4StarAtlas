import { createFileRoute } from "@tanstack/react-router";
import { buildMarket } from "@/lib/desk.impl";

const ALLOWED_ORIGIN = "https://walkingyog.com";

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  return {
    ...(origin === ALLOWED_ORIGIN ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export const Route = createFileRoute("/api/market")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, {
          status: 204,
          headers: { ...corsHeaders(request), "Access-Control-Max-Age": "600" },
        }),
      GET: async ({ request }) => {
        try {
          const market = await buildMarket();
          return Response.json(market, { headers: corsHeaders(request) });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Рынок не прочитался." },
            { status: 502, headers: corsHeaders(request) },
          );
        }
      },
    },
  },
});
