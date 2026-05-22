/**
 * Proxies /api/* to the sat-api Worker when deployed via Wrangler Pages
 * with a SAT_API service binding (see apps/web/wrangler.toml).
 */
interface Env {
  SAT_API: Fetcher;
}

type PagesContext = {
  request: Request;
  env: Env;
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (!context.env.SAT_API) {
    return Response.json(
      {
        error:
          "SAT_API binding missing. Deploy Pages with apps/web/wrangler.toml or set VITE_API_BASE to your Worker URL.",
      },
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  return context.env.SAT_API.fetch(context.request);
};
