import { z } from "zod";

/** A fact as the page displayed it: its id and the version it showed. A decision on it holds only for that version. */
export const factRef = z.object({ id: z.string().uuid(), version: z.number().int().positive() }).strict();
export type FactRef = z.infer<typeof factRef>;

/**
 * The body of POST /api/profile/facts. Strict objects, replace first: a
 * loose union read { replaceWith } as an empty decision and did nothing,
 * which the first browser check caught.
 *
 *   { replaceWith, seen }  confirm every waiting fact of the document and
 *                          retire the resume facts before it; `seen` is the
 *                          list of waiting facts the page displayed with
 *                          their versions, and the replacement is refused
 *                          if the document's waiting facts differ from it.
 *   { edit }               replace a waiting fact's data with what the user
 *                          typed, at the version the page showed; the fact
 *                          stays waiting at the next version.
 *   { confirm, reject }    single decisions, each by id or by id and
 *                          version; with a version the decision is skipped
 *                          if the fact has moved on since the page showed it.
 */
export const decisionBody = z.union([
  z.object({ replaceWith: z.string().uuid(), seen: z.array(factRef).optional() }).strict(),
  z.object({ edit: z.object({ id: z.string().uuid(), version: z.number().int().positive(), data: z.record(z.string(), z.unknown()) }).strict() }).strict(),
  z
    .object({
      confirm: z.array(z.union([z.string().uuid(), factRef])).optional(),
      reject: z.array(z.union([z.string().uuid(), factRef])).optional(),
    })
    .strict(),
]);

export type DecisionBody = z.infer<typeof decisionBody>;
