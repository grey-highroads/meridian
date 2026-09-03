// Getting the frozen brief to production.
//
// Grey ruled on 2026-09-03 that pressing the button is sending, and delivery is
// a receipt from production's side. Two facts, not one. This module does the
// first half of that: it posts the sidecar and reports whether an
// acknowledgement came back. Writing either fact belongs to the tour route.
//
// It ships inert. With either configuration value missing, no request is
// attempted and the caller is told so plainly. Setting MERIDIAN_PRODUCTION_URL
// and MERIDIAN_PRODUCTION_SECRET on the deployment turns it on, and nothing
// else has to change.
//
// What goes over the wire is exactly what renderBriefSidecar returns. Nothing
// here reshapes the payload for production's benefit, and nothing here assumes
// anything about the workflow on the other end. The one thing it reads out of
// the answer is a time, and a missing time is a missing time rather than a
// failure.

import { ownEntry } from "../lookup.js";

const TIMEOUT_MS = 8000;

export function productionEndpoint(env = process.env) {
  return {
    url: String(env.MERIDIAN_PRODUCTION_URL || "").trim(),
    secret: String(env.MERIDIAN_PRODUCTION_SECRET || "").trim(),
  };
}

// The answer arrives from another system, so its fields are read through the
// own-property helper rather than off the object.
function answerField(body, name) {
  if (!body || typeof body !== "object") return null;
  const value = ownEntry(body, name);
  return value ? String(value) : null;
}

function acknowledgedTime(body) {
  return answerField(body, "acknowledgedAt") || answerField(body, "receivedAt");
}

export async function deliverBrief(sidecar, options = {}) {
  const { url, secret } = productionEndpoint(options.env || process.env);
  if (!url || !secret) {
    return {
      attempted: false,
      acknowledged: false,
      acknowledgedAt: null,
      jobId: null,
      reason: "This deployment has no production address and secret set, so nothing was posted.",
    };
  }
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(sidecar),
      signal: controller.signal,
    });
  } catch (error) {
    return {
      attempted: true,
      acknowledged: false,
      acknowledgedAt: null,
      jobId: null,
      reason: `Production did not answer. ${error.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    return {
      attempted: true,
      acknowledged: false,
      acknowledgedAt: null,
      jobId: null,
      reason: `Production answered with status ${response.status}.`,
    };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  // A 2xx alone says something was received. It does not say this job was.
  // The answer has to name the job we posted, because the job id is the
  // identity both systems work from and it is the one thing in the fact we
  // write that came from outside Meridian. An answer naming a different job,
  // or naming none, is not an acknowledgement of this brief, so nothing is
  // recorded and the person is told what came back. Ruled 2026-09-03.
  const named = answerField(body, "jobId");
  const expected = answerField(sidecar, "jobId");
  if (!named || named !== expected) {
    return {
      attempted: true,
      acknowledged: false,
      acknowledgedAt: null,
      jobId: null,
      reason: named
        ? `Production answered about job ${named} and this brief is job ${expected}.`
        : "Production answered without naming the job, so nothing was recorded against this brief.",
    };
  }
  return {
    attempted: true,
    acknowledged: true,
    acknowledgedAt: acknowledgedTime(body),
    jobId: named,
    reason: null,
  };
}
