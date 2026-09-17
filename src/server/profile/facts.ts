import { z } from "zod";

/*
 * The shape of `profile_facts.data`, one schema per kind. Three kinds feed
 * the hard filter; employment, education, skill and answer are what the
 * scorer reads as the profile. Extraction will write the same shapes.
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

const yearMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM");

/** One role. `end` absent means current. Bullets are the resume's own lines, not a summary of them. */
export const employmentFact = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  start: yearMonth,
  end: yearMonth.optional(),
  bullets: z.array(z.string().min(1)).min(1),
});

export const educationFact = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  start: yearMonth.optional(),
  end: yearMonth.optional(),
  notes: z.array(z.string().min(1)).optional(),
});

/** One skill per row, as extraction produces them. */
export const skillFact = z.object({
  name: z.string().min(1),
  years: z.number().int().nonnegative().optional(),
  evidence: z.string().optional(),
});

/** A standing answer to an application question, in the user's words. */
export const answerFact = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

/** The contact line extraction reads: name, email and location as written. At least one of them. */
export const contactFact = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    location: z.string().optional(),
  })
  .refine((c) => [c.name, c.email, c.location].some((v) => v && v.trim()), { message: "a contact needs a name, an email or a location" });

/** A link on the resume, as written; the scheme is not required because resumes print "linkedin.com/in/jack". */
export const linkFact = z.object({ url: z.string().min(1) });

/** A project the user names, with optional lines. Extraction does not produce these yet; the editor offers the kind, so it has a shape. */
export const projectFact = z.object({
  name: z.string().min(1),
  notes: z.array(z.string()).optional(),
});

export type EmploymentFact = z.infer<typeof employmentFact>;
export type EducationFact = z.infer<typeof educationFact>;
export type SkillFact = z.infer<typeof skillFact>;
export type AnswerFact = z.infer<typeof answerFact>;

export type PreferenceFact = z.infer<typeof preferenceFact>;
export type AuthorizationFact = z.infer<typeof authorizationFact>;
export type SponsorshipFact = z.infer<typeof sponsorshipFact>;

/** Every kind the editor may offer has a schema here; an edit on a kind without one is refused, never thrown (D-026). */
export const FACT_SCHEMAS = {
  preference: preferenceFact,
  authorization: authorizationFact,
  sponsorship: sponsorshipFact,
  employment: employmentFact,
  education: educationFact,
  skill: skillFact,
  answer: answerFact,
  contact: contactFact,
  link: linkFact,
  project: projectFact,
} as const;
