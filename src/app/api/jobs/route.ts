import { FEED_PAGE, feedForUser, type FeedFilters } from "@/server/jobs/feed";
import { viewerFacts } from "@/server/profile/viewer";
import { currentUserId } from "@/server/user";

/** Reads the database on every call; never prerendered at build. */
export const dynamic = "force-dynamic";

/**
 * GET /api/jobs?q=&hours=&loc=&workplace=&co=&level=&sponsor=1&exclude=&offset=&limit=
 * List parameters repeat: co=Stripe&co=Airbnb. `exclude` is comma separated.
 * The response carries the page, the filtered total, the inventory size and
 * company count, the facets, and what the viewer's facts say.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const list = (k: string) => p.getAll(k).map((v) => v.trim()).filter(Boolean);
  const num = (k: string) => {
    const n = Number(p.get(k));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
  };
  const filters: FeedFilters = {
    q: p.get("q") ?? undefined,
    hours: num("hours"),
    loc: list("loc"),
    workplace: list("workplace"),
    co: list("co"),
    level: list("level"),
    sponsor: p.get("sponsor") === "1",
    exclude: (p.get("exclude") ?? "")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean),
  };
  const userId = await currentUserId();
  const [page, viewer] = await Promise.all([
    feedForUser(userId, { limit: num("limit") ?? FEED_PAGE, offset: num("offset") ?? 0, filters }),
    viewerFacts(userId),
  ]);
  return Response.json({ ...page, viewer });
}
