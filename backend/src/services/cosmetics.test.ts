import assert from "node:assert/strict";
import test from "node:test";
import { resolveLoadout } from "./cosmetics.js";

test("loadout preserves omitted slots and allows explicit unequip", () => {
  const current = { frame_id: "frame-standard", theme_id: "theme-night", badge_id: "badge-challenge" };
  assert.deepEqual(resolveLoadout(current, { frameId: null, badgeId: "badge-new" }), {
    frame_id: null, theme_id: "theme-night", badge_id: "badge-new",
  });
});
