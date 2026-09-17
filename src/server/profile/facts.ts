import { z } from "zod";

/*
 * The shape of `profile_facts.data`, one schema per kind. The three kinds
 * that feed the hard filter are here in full; the resume kinds arrive with
 * extraction.
 *
 * ID-05: location, relocation, remote preference, employment types and
 * exclusions are preferences the user states. ID-06: work authorization and
 * sponsorship need are user provided, explicit, dated and editable. Nothing
 * here is inferred from where the user lives: there is no home country, only
 * the countries the user has chosen and the countries they say they may work
 * in.
 */

export const iso2 = z.string().regex(/^[A-Z]{2}$/, "ISO 3166 alpha 2, upper case");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const preferenceFact = z
  .object({
    /** Countries the user wants to work in, or "any". Never defaulted from an address. */
    targetCountries: z.union([z.literal("any"), z.array(iso2).min(1)]),
    /**
     * Whether the user will move for a role. "no" means on site roles pass only
     * in `onsiteCountries`, which the user lists themselves; remote roles are
     * unaffected. The filter falls back to the target countries if the list is
     * missing, but the schema refuses to save that combination when the
     * targets are a list, so the fallback is a safety net rather than the path.
     */
    relocation: z.enum(["yes", "no"]),
    onsiteCountries: z.array(iso2).optional(),
    /** remote_only: only remote roles. remote_ok: remote or on site. no_remote: on site only. */
    remote: z.enum(["remote_only", "remote_ok", "no_remote"]),
    /** Employment types accepted, as the boards label them. A job with no type stated passes. */
    employmentTypes: z.array(z.string().min(1)).optional(),
    /** JOB-07: blocked employers and words. A blocked word fails a job wherever it appears in title, company or location. */
    excludedCompanies: z.array(z.string().min(1)).optional(),
    excludedKeywords: z.array(z.string().min(1)).optional(),
    earliestStart: isoDate.optional(),
  })
  .superRefine((p, ctx) => {
    if (p.relocation === "no" && p.targetCountries !== "any" && !p.onsiteCountries?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["onsiteCountries"],
        message: "With relocation set to no, list the countries you will work on site in",
      });
    }
  });

/** One per country the user may already work in. "none" is an explicit answer, not an absence. */
export const authorizationFact = z.object({
  country: iso2,
  basis: z.enum(["citizen", "permanent_resident", "work_permit", "student", "other", "none"]),
  validUntil: isoDate.optional(),
  statedOn: isoDate,
});

/** Sponsorship need, separate from authorization and dated. */
export const sponsorshipFact = z.object({
  now: z.boolean(),
  future: z.boolean(),
  statedOn: isoDate,
  note: z.string().optional(),
});

export type PreferenceFact = z.infer<typeof preferenceFact>;
export type AuthorizationFact = z.infer<typeof authorizationFact>;
export type SponsorshipFact = z.infer<typeof sponsorshipFact>;

export const FACT_SCHEMAS = {
  preference: preferenceFact,
  authorization: authorizationFact,
  sponsorship: sponsorshipFact,
} as const;
