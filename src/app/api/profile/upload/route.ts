import { dbPool } from "@/db/client";
import { ExtractError, extractUpload } from "@/server/profile/extract";
import { currentUserId } from "@/server/user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/profile/upload, multipart with one `file`, a PDF. Stores the
 * file, runs one extraction call, stores every fact as extracted with its
 * evidence, and returns what the confirmation screen needs. The facts are
 * not read by anything until the user confirms them (ID-03).
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return Response.json({ error: "only PDF resumes are accepted in phase 0" }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "the file is over 5 MB" }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const userId = await currentUserId();
  try {
    const out = await extractUpload(dbPool(), userId, { filename: file.name, bytes });
    return Response.json(out);
  } catch (e) {
    const message = e instanceof ExtractError ? e.message : e instanceof Error ? e.message : String(e);
    return Response.json({ error: `extraction failed: ${message}` }, { status: 502 });
  }
}
