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
 *                               needs it now, and holds no valid authorization
 *                               in a country that puts the job in reach: the
 *                               target country, the work arrangement and the
 *                               authorization must agree on one location, so
 *                               a permit in a listed country the user is not
 *                               targeting does not count. Unknown sponsorship
 *                               passes: unknown is unknown, never a no (JOB-04)
 *
 * An authorization with a validUntil in the past is not an authorization.
 * A restriction with alternatives, "citizens or permanent residents", passes
 * when any alternative is met in full.
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

/** Authorizations that hold today: no validUntil, or one that has not passed. */
export function validAuthorizations(auth: AuthorizationFact[], today = new Date().toISOString().slice(0, 10)): AuthorizationFact[] {
  return auth.filter((a) => a.basis !== "none" && (!a.validUntil || a.validUntil >= today));
}

export function hardFilterSql({ prefs, auth: allAuth, sponsorship }: FilterFacts, today?: string): SQL {
  const auth = validAuthorizations(allAuth, today);
  const targets: string[] = prefs.targetCountries === "any" ? [] : prefs.targetCountries;
  const any = prefs.targetCountries === "any";
  const inTargets: SQL = any ? sql`true` : inCountries(targets);
  /** Countries of the job's locations that put it in reach for this user: the target countries, or all of them with "any". */
  const reach = (countries: readonly string[]): SQL =>
    countries.length
      ? any
        ? inCountries(countries)
        : sql`exists (select 1 from ${LOC} where l->>'country' in (${params(countries)}) and l->>'country' in (${params(targets)}))`
      : sql`false`;

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

  // Stated restrictions. Met through a valid authorization in the
  // restriction's country or, with no country named, in a country that puts
  // the job in reach. With alternatives, any one met in full passes; the
  // reason names the first term of the first alternative that fails.
  const meets = (countries: string[]): SQL =>
    countries.length ? sql`coalesce(j.eligibility_country in (${params(countries)}), ${reach(countries)})` : sql`false`;
  const citizens = auth.filter((a) => a.basis === "citizen").map((a) => a.country);
  const residents = auth.filter((a) => a.basis === "citizen" || a.basis === "permanent_resident").map((a) => a.country);
  const authorised = auth.map((a) => a.country);
  const termMet: Record<string, SQL> = {
    clearance: sql`false`,
    citizenship: meets(citizens),
    permanent_residency: meets(residents),
    right_to_work: meets(authorised),
  };
  const REASON: Record<string, string> = {
    clearance: "needs a security clearance, Jobluvo does not handle these",
    citizenship: "citizenship required",
    permanent_residency: "permanent residency required",
    right_to_work: "right to work required",
  };
  // options is a jsonb array of arrays; each inner array is one alternative.
  const optionMet = (term: string): SQL => sql`(${termMet[term]})`;
  const anyOptionMet = sql`exists (
    select 1 from jsonb_array_elements(coalesce(j.eligibility_options, jsonb_build_array(jsonb_build_array(j.eligibility::text)))) opt
    where not exists (
      select 1 from jsonb_array_elements_text(opt) term
      where not case term
        when 'clearance' then ${optionMet("clearance")}
        when 'citizenship' then ${optionMet("citizenship")}
        when 'permanent_residency' then ${optionMet("permanent_residency")}
        when 'right_to_work' then ${optionMet("right_to_work")}
        else false end
    )
  )`;
  const restriction = sql`case
    when j.eligibility is null then null
    when ${anyOptionMet} then null
    when j.eligibility = 'clearance' then ${REASON.clearance}
    when j.eligibility = 'citizenship' then ${REASON.citizenship}
    when j.eligibility = 'permanent_residency' then ${REASON.permanent_residency}
    when j.eligibility = 'right_to_work' then ${REASON.right_to_work}
    end`;

  // Sponsorship: needed now, the posting says no, and no valid authorization
  // in a country that puts this job in reach.
  const sponsorshipRule: SQL = sponsorship?.now
    ? sql`case when j.sponsorship = 'not_offered' and not ${reach(authorised)} then 'sponsorship not offered' end`
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
