import type { FastifyInstance } from "fastify";
import { requireUser } from "../plugins/auth.js";
import { issueRoomTicket } from "../rooms/tickets.js";
import { z } from "zod";
import { createChallengeLink, listFriends, requestFriend, resolveChallengeLink, respondFriend } from "../services/social.js";
import { createTicket } from "../services/admin.js";

export async function socialRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/rooms/ticket", async (request) => {
    const user = requireUser(request);
    const ticket = await issueRoomTicket(user.id);
    return { ok: true, ...ticket };
  });

  app.get("/api/friends", async (request) => {
    const user = requireUser(request);
    const friends = await listFriends(user.id);
    return { ok: true, friends };
  });

  app.post("/api/friends/request", async (request) => {
    const user = requireUser(request);
    const body = z.object({ email: z.string().email() }).parse(request.body);
    const result = await requestFriend(user.id, body.email, request.ip);
    return { ok: true, ...result };
  });

  app.post("/api/friends/respond", async (request) => {
    const user = requireUser(request);
    const body = z.object({ userId: z.string().uuid(), accept: z.boolean() }).parse(request.body);
    const result = await respondFriend(user.id, body.userId, body.accept);
    return { ok: true, ...result };
  });

  app.post("/api/challenges/share", async (request) => {
    const user = requireUser(request);
    const body = z.object({ slug: z.string() }).parse(request.body);
    const result = await createChallengeLink(user.id, body.slug, request.ip);
    return { ok: true, ...result };
  });

  app.get("/api/challenges/:code", async (request) => {
    const params = z.object({ code: z.string().min(4) }).parse(request.params);
    const result = await resolveChallengeLink(params.code);
    return { ok: true, ...result };
  });

  app.post("/api/support/tickets", async (request) => {
    const body = z
      .object({
        name: z.string().min(1).max(80),
        email: z.string().email(),
        topic: z.string().min(1).max(80),
        message: z.string().min(1).max(4000),
        paymentRef: z.string().max(80).optional(),
      })
      .parse(request.body);
    const id = await createTicket({ ...body, userId: request.authUser?.id });
    return { ok: true, id };
  });
}
