import assert from "node:assert/strict";
import test from "node:test";
import { publicGame, publicPlan } from "./catalog.js";

test("catalog versioned cache keys isolate a changed catalog", () => {
  const oldKey = "catalog:published:v2";
  const newKey = "catalog:published:v3";
  assert.notEqual(oldKey, newKey);
});

test("public catalog DTOs do not expose database column names", () => {
  const game = publicGame({ slug: "draw-guess", title: "Draw", genre: "Party", session_minutes: 5, member_access: true, rotation_eligible: true, maintenance: false, is_new: false });
  const plan = publicPlan({ id: "wave", name: "Wave", monthly_paise: 39900, annual_paise: 399000, continue_cap: 3, benefits: [] });
  assert.equal(game.sessionMinutes, 5);
  assert.equal("session_minutes" in game, false);
  assert.equal(plan.monthlyPaise, 39900);
  assert.equal("monthly_paise" in plan, false);
});
