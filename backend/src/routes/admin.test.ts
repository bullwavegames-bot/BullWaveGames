import assert from "node:assert/strict";
import test from "node:test";
import { gameUpdateSchema } from "./admin.js";

test("admin game update accepts known fields and rejects unknown fields", () => {
  assert.equal(gameUpdateSchema.parse({ slug: "draw-guess", title: "Draw & Guess" }).slug, "draw-guess");
  assert.throws(() => gameUpdateSchema.parse({ slug: "draw-guess", unsafe: true }), /Unrecognized key/);
});
