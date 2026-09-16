import { env } from "@/lib/env";

/**
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled calls.
 * Local runs pass the same header by hand. Anything else is a 401.
 */
export function cronAuthorised(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env().CRON_SECRET}`;
}

export function unauthorised(): Response {
  return Response.json({ error: "unauthorised" }, { status: 401 });
}
