import assert from "node:assert/strict";
import test from "node:test";
import { hashResumeCredential, resumeReservationExpiry } from "./resume.js";

test("resume credential hashing is deterministic and opaque", () => {
  const credential = "opaque-resume-credential";
  assert.equal(hashResumeCredential(credential), hashResumeCredential(credential));
  assert.notEqual(hashResumeCredential(credential), credential);
});

test("resume reservation expires about thirty seconds after creation", () => {
  const before = Date.now();
  const expiry = resumeReservationExpiry();
  assert.ok(expiry >= before + 30_000 && expiry <= before + 30_100);
});
