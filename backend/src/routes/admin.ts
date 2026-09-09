import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../plugins/auth.js";
import {
  adminStats,
  grantPlan,
  listGamesAdmin,
  listMembers,
  listNotes,
  listTickets,
  memberDetail,
  revokePlan,
  saveGame,
  saveNote,
} from "../services/admin.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request) => {
    requireAdmin(request);
  });

  app.get("/api/admin/stats", async () => ({ ok: true, ...(await adminStats()) }));

  app.get("/api/admin/members", async (request) => {
    const query = z
      .object({
        q: z.string().default(""),
        page: z.coerce.number().int().min(1).default(1),
      })
      .parse(request.query);
    const members = await listMembers(query.q, query.page);
    return { ok: true, members };
  });

  app.get("/api/admin/members/:id", async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const detail = await memberDetail(params.id);
    return { ok: true, ...detail };
  });

  app.post("/api/admin/members/:id/grant", async (request) => {
    const admin = requireAdmin(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        planId: z.enum(["wave", "surge", "tide"]),
        days: z.number().int().min(1).max(366),
        reason: z.string().min(3),
      })
      .parse(request.body);
    await grantPlan(admin.id, params.id, body.planId, body.days, body.reason);
    return { ok: true };
  });

  app.post("/api/admin/members/:id/revoke", async (request) => {
    const admin = requireAdmin(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ reason: z.string().min(3) }).parse(request.body);
    await revokePlan(admin.id, params.id, body.reason);
    return { ok: true };
  });

  app.get("/api/admin/games", async () => ({ ok: true, games: await listGamesAdmin() }));

  app.put("/api/admin/games", async (request) => {
    const admin = requireAdmin(request);
    const body = z.record(z.unknown()).parse(request.body);
    const saved = await saveGame(admin.id, body);
    return { ok: true, ...saved };
  });

  app.get("/api/admin/content", async () => ({ ok: true, notes: await listNotes() }));

  app.put("/api/admin/content", async (request) => {
    const admin = requireAdmin(request);
    const body = z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1),
        type: z.string().min(1),
        status: z.string().min(1),
        body: z.string(),
      })
      .parse(request.body);
    const saved = await saveNote(admin.id, body);
    return { ok: true, ...saved };
  });

  app.get("/api/admin/tickets", async () => ({ ok: true, tickets: await listTickets() }));
}
