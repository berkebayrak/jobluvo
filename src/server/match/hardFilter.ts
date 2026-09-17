import { sql, type SQL } from "drizzle-orm";
import type { AuthorizationFact, PreferenceFact, SponsorshipFact } from "@/server/profile/facts";

/*
 * The hard filter, JOB-06: enforced before ranking, from the user's own
 * facts and nothing else. `hardFilterSql` is a Drizzle SQL expression over
 * a `jobs` row aliased `j` that yields the first failing reason, or NULL
 * when the job passes, so one query answers both "does it pass" and "why
 * not". Every user supplied value travels as a bound parameter; nothing is
 * pasted into the statement.
 *
 * Order of the reasons, and what each means:
 *
 *   'remote role'               the user takes on site roles only
 *   'not remote'                the user takes remote roles only
 *   'not in target countries'   no location of the job is in a country the
 *                               user chose, and it is not a remote role in
 *                               reach
 *   'remote, country unknown'   the job is remote but no location states a
 *                               country, and the user limits countries
 *   'relocation'                on site role outside the countries the user
 *                               will work on site in; with none listed,
 *                               those are the target countries
 *   'needs a security clearance, Jobluvo does not handle these'
 *                               a product decision, not a missing fact:
 *                               cleared roles are out of scope, so the rule
 *                               stays even when a clearance field exists
 *   'citizenship required'      the posting states a restriction the user's
 *   'permanent residency required'   authorization facts do not meet, in the
 *   'right to work required'    country the sentence names or, when it names
 *                               none, in the job's own countries
 *   'sponsorship not offered'   the posting says no sponsorship, the user
 *                               needs it now, and holds no authorization for
 *                               that country. Unknown sponsorship passes:
 *                               unknown is unknown, never a no (JOB-04)
 *   'employment type'           the posting states a type the user excluded.
 *                               A posting with no type passes
 *   'excluded company'          the user blocked the employer (JOB-07)
 *   'excluded keyword'          a blocked word appears in the title, the
 *                               company or a location (JOB-07)
 */

export interface FilterFacts {
  prefs: PreferenceFact;
  auth: AuthorizationFact[];
  sponsorship: SponsorshipFact | null;
}

export const FILTER_REASONS = [
  "remote role",
  "not remote",
  "not in target countries",
  "remote, country unknown",
  "relocation",
  "needs a security clearance, Jobluvo does not handle these",
  "citizenship required",
  "permanent residency required",
  "right to work required",
  "sponsorship not offered",
  "employment type",
  "excluded company",
  "excluded keyword",
] as const;

const LOC = sql`jsonb_array_elements(j.locations) l`;
const HAS_COUNTRY = sql`exists (select 1 from ${LOC} where l->>'country' is not null)`;
const IS_REMOTE = sql`(j.workplace = 'remote' or exists (select 1 from ${LOC} where (l->>'remote')::boolean))`;

const params = (xs: readonly string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);
/** `exists (a location's country is in the list)`, or false for an empty list. */
const inCountries = (xs: readonly string[]): SQL =>
  xs.length ? sql`exists (select 1 from ${LOC} where l->>'country' in (${params(xs)}))` : sql`false`;
const hay = (word: string): SQL => {
  const like = `%${word}%`;
  return sql`(j.title ilike ${like} or j.company_name ilike ${like} or exists (select 1 from ${LOC} where l->>'raw' ilike ${like}))`;
};

export function hardFilterSql({ prefs, auth, sponsorship }: FilterFacts): SQL {
  const targets: string[] = prefs.targetCountries === "any" ? [] : prefs.targetCountries;
  const any = prefs.targetCountries === "any";
  const inTargets: SQL = any ? sql`true` : inCountries(targets);

  // Location, one CASE: the remote preference first, then reach.
  const cases: SQL[] = [];
  if (prefs.remote === "no_remote") cases.push(sql`when ${IS_REMOTE} then 'remote role'`);
  if (prefs.remote === "remote_only") cases.push(sql`when not ${IS_REMOTE} then 'not remote'`);
  cases.push(sql`when ${inTargets} then null`);
  if (prefs.remote !== "no_remote" && !any) cases.push(sql`when ${IS_REMOTE} and not ${HAS_COUNTRY} then 'remote, country unknown'`);
  const location = sql`case ${sql.join(cases, sql` `)} else 'not in target countries' end`;

  // Relocation "no": an on site role passes only in the countries the user
  // will work on site in; with none listed, the target countries stand in.
  // With "any" and none listed there is nothing to hold the user to.
  let relocation: SQL = sql`null`;
  if (prefs.relocation === "no") {
    const onsite = prefs.onsiteCountries?.length ? prefs.onsiteCountries : any ? null : targets;
    if (onsite) relocation = sql`case when not ${IS_REMOTE} and not ${inCountries(onsite)} then 'relocation' end`;
  }

  // Stated restrictions. Met through an authorization fact in the
  // restriction's country; with no country named, the job's own countries.
  const meets = (countries: string[]): SQL =>
    countries.length ? sql`coalesce(j.eligibility_country in (${params(countries)}), ${inCountries(countries)})` : sql`false`;
  const citizens = auth.filter((a) => a.basis === "citizen").map((a) => a.country);
  const residents = auth.filter((a) => a.basis === "citizen" || a.basis === "permanent_resident").map((a) => a.country);
  const authorised = auth.filter((a) => a.basis !== "none").map((a) => a.country);
  const restriction = sql`case
    when j.eligibility = 'clearance' then 'needs a security clearance, Jobluvo does not handle these'
    when j.eligibility = 'citizenship' and not ${meets(citizens)} then 'citizenship required'
    when j.eligibility = 'permanent_residency' and not ${meets(residents)} then 'permanent residency required'
    when j.eligibility = 'right_to_work' and not ${meets(authorised)} then 'right to work required'
    end`;

  const sponsorshipRule: SQL = sponsorship?.now
    ? sql`case when j.sponsorship = 'not_offered' and not ${inCountries(authorised)} then 'sponsorship not offered' end`
    : sql`null`;

  const employment: SQL = prefs.employmentTypes?.length
    ? sql`case when j.employment_type is not null and j.employment_type not in (${params(prefs.employmentTypes)}) then 'employment type' end`
    : sql`null`;

  const companies = (prefs.excludedCompanies ?? []).map((c) => c.toLowerCase());
  const excludedCompany: SQL = companies.length
    ? sql`case when lower(j.company_name) in (${params(companies)}) then 'excluded company' end`
    : sql`null`;

  const words = (prefs.excludedKeywords ?? []).map((w) => w.trim()).filter(Boolean);
  const excludedKeyword: SQL = words.length
    ? sql`case when ${sql.join(
        words.map((w) => hay(w)),
        sql` or `,
      )} then 'excluded keyword' end`
    : sql`null`;

  return sql`coalesce(${location}, ${relocation}, ${restriction}, ${sponsorshipRule}, ${employment}, ${excludedCompany}, ${excludedKeyword})`;
}
