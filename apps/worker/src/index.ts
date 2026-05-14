import { Hono } from "hono";
import { cors } from "hono/cors";
import { CURATED_GROUPS, HOT_GROUPS_FOR_CRON } from "./groups.js";
import {
  getGroupPayloadWithSwr,
  refreshGroupCache,
  type WorkerEnv,
} from "./service.js";

const app = new Hono<{ Bindings: WorkerEnv }>();

const cacheHeaders = { "Cache-Control": "private, max-age=300" };

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "sat-api" }, 200, cacheHeaders)
);

app.get("/api/groups", (c) =>
  c.json({ groups: CURATED_GROUPS }, 200, cacheHeaders)
);

app.get("/api/tle", async (c) => {
  const group = c.req.query("group");
  if (!group) {
    return c.json({ error: "Missing query parameter: group" }, 400);
  }
  if (!CURATED_GROUPS.some((g) => g.id === group)) {
    return c.json({ error: `Unknown group: ${group}` }, 404);
  }
  const payload = await getGroupPayloadWithSwr(
    c.env,
    group,
    c.executionCtx
  );
  return c.json(payload, 200, cacheHeaders);
});

app.get("/api/satellites", async (c) => {
  const group = c.req.query("group");
  const q = c.req.query("q")?.trim().toLowerCase() ?? "";
  if (!group) {
    return c.json({ error: "Missing query parameter: group" }, 400);
  }
  if (!CURATED_GROUPS.some((g) => g.id === group)) {
    return c.json({ error: `Unknown group: ${group}` }, 404);
  }
  const payload = await getGroupPayloadWithSwr(
    c.env,
    group,
    c.executionCtx
  );
  let { satellites } = payload;
  if (q) {
    satellites = satellites.filter((s) => {
      const name = s.OBJECT_NAME.toLowerCase();
      const id = String(s.NORAD_CAT_ID);
      return name.includes(q) || id.includes(q);
    });
  }
  return c.json({ ...payload, satellites }, 200, cacheHeaders);
});

app.get("/api/elements", async (c) => {
  const id = c.req.query("satelliteId");
  if (!id) {
    return c.json({ error: "Missing query parameter: satelliteId" }, 400);
  }
  const norad = Number.parseInt(id, 10);
  if (!Number.isFinite(norad)) {
    return c.json({ error: "Invalid satelliteId" }, 400);
  }
  const group = c.req.query("group");
  if (group) {
    if (!CURATED_GROUPS.some((g) => g.id === group)) {
      return c.json({ error: `Unknown group: ${group}` }, 404);
    }
    const payload = await getGroupPayloadWithSwr(
      c.env,
      group,
      c.executionCtx
    );
    const record =
      payload.satellites.find((s) => s.NORAD_CAT_ID === norad) ?? null;
    return c.json(
      { satelliteId: norad, source: payload.source, record },
      200,
      cacheHeaders
    );
  }
  for (const g of CURATED_GROUPS) {
    const payload = await getGroupPayloadWithSwr(
      c.env,
      g.id,
      c.executionCtx
    );
    const record = payload.satellites.find((s) => s.NORAD_CAT_ID === norad);
    if (record) {
      return c.json(
        { satelliteId: norad, source: payload.source, record },
        200,
        cacheHeaders
      );
    }
  }
  return c.json(
    { satelliteId: norad, source: "none", record: null },
    200,
    cacheHeaders
  );
});

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    for (const gid of HOT_GROUPS_FOR_CRON) {
      ctx.waitUntil(refreshGroupCache(env, gid));
    }
    if (env.SPACE_TRACK_USER && env.SPACE_TRACK_PASSWORD) {
      ctx.waitUntil(refreshGroupCache(env, "iss-spacetrack"));
    }
  },
};
