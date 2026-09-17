import { z } from "zod";

/**
 * The body of POST /api/profile/facts. Strict objects, replace first: a
 * loose union read { replaceWith } as an empty decision and did nothing,
 * which the first browser check caught.
 */
export const decisionBody = z.union([
  z.object({ replaceWith: z.string().uuid() }).strict(),
  z.object({ confirm: z.array(z.string().uuid()).optional(), reject: z.array(z.string().uuid()).optional() }).strict(),
]);

export type DecisionBody = z.infer<typeof decisionBody>;
