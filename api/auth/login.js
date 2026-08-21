import { readJsonBody, sendJson } from "../../src/server/http.js";

const SESSION_COOKIE = "bws_session";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  const expected = process.env.BRAND_WORLD_ACCESS_PASSWORD;
  if (!expected) {
    sendJson(response, 503, { ok: false, error: "not_configured" });
    return;
  }

  try {
    const { username, password } = await readJsonBody(request);

    if (username === "brandworld" && password === expected) {
      const token = Buffer.from("brandworld:" + expected).toString("base64");
      const parts = [
        `${SESSION_COOKIE}=${token}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=86400",
      ];
      if (process.env.VERCEL) parts.push("Secure");
      response.setHeader("Set-Cookie", parts.join("; "));
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 401, { ok: false, error: "invalid" });
  } catch (err) {
    sendJson(response, 400, { ok: false, error: "bad_request" });
  }
}
