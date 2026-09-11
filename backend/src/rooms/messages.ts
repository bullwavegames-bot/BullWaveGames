import { z } from "zod";

const action = { actionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional() };
const mode = z.enum(["draw-guess", "multiplayer-ludo", "live-trivia", "trivia-battle"]);

export const roomMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), mode, name: z.string().trim().min(1).max(24), team: z.enum(["Blue", "Gold", "Solo"]).optional(), ...action }).strict(),
  z.object({ type: z.literal("join"), code: z.string().regex(/^[A-Za-z0-9]{6}$/), mode, name: z.string().trim().min(1).max(24), team: z.enum(["Blue", "Gold", "Solo"]).optional(), ...action }).strict(),
  z.object({ type: z.literal("resume"), code: z.string().regex(/^[A-Za-z0-9]{6}$/), playerId: z.string().uuid(), credential: z.string().min(32).max(128), ...action }).strict(),
  z.object({ type: z.literal("leave"), ...action }).strict(),
  z.object({ type: z.literal("start"), ...action }).strict(),
  z.object({ type: z.literal("stroke"), line: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]), color: z.enum(["#f1f5f9", "#61d6b0", "#43c7e8", "#d5aa50", "#f16f78"]).optional(), ...action }).strict(),
  z.object({ type: z.literal("clear"), ...action }).strict(),
  z.object({ type: z.literal("guess"), text: z.string().trim().min(1).max(80), ...action }).strict(),
  z.object({ type: z.literal("answer"), answer: z.number().int().min(0).max(3), round: z.number().int().min(0).max(100), ...action }).strict(),
  z.object({ type: z.literal("roll"), ...action }).strict(),
  z.object({ type: z.literal("move"), index: z.number().int().min(0).max(3), ...action }).strict(),
]);

export type RoomMessage = z.infer<typeof roomMessageSchema>;
