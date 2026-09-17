import type { AuthorizationFact, PreferenceFact, SponsorshipFact } from "@/server/profile/facts";

/*
 * The hard filter, JOB-06: enforced before ranking, from the user's own
 * facts and nothing else. It is a SQL expression over a `jobs` row aliased
 * `j` that yields the first failing reason, or NULL when the job passes,
 * so one query answers both "does it pass" and "why not".
 *
 * Order of the reasons, and what each means:
 *
 *   'not in target countries'   no location of the job is in a country the
 *                               user chose, and the job is not a remote role
 *                               the user would take
 *   'remote, country unknown'   the job is remote but no location states a
 *                               country, and the user limits countries
 *   'not remote'                the user takes remote roles only
 *   'relocation'                on site role outside the countries the user
 *                               will work on site in
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
 *   'excluded company'          the user blocked the employer
 *
 * Every country value is validated as [A-Z]{2} by the fact schema, so it can
 * be inlined as a literal.
 */

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const list = (xs: readonly string[]) => (xs.length ? `(${xs.map(lit).join(", ")})` : "(NULL)");

const LOC = `jsonb_array_elements(j.locations) l`;
const HAS_COUNTRY = `exists (select 1 from ${LOC} where l->>'country' is not null)`;
const IS_REMOTE = `(j.workplace = 'remote' or exists (select 1 from ${LOC} where (l->>'remote')::boolean))`;

export function firstFailingReasonSql(prefs: PreferenceFact, auth: AuthorizationFact[], sponsorship: SponsorshipFact | null): string {
  const targets = prefs.targetCountries === "any" ? [] : prefs.targetCountries;
  const any = prefs.targetCountries === "any";
  const inTargets = any ? "true" : `exists (select 1 from ${LOC} where l->>'country' in ${list(targets)})`;
  const remoteOk = prefs.remote !== "no_remote";

  // Location. A job is in reach if a location is in a target country, or it
  // is remote and the user takes remote roles: in a target country, or with
  // no country stated only when the user targets any country.
  const remoteInReach = !remoteOk ? "false" : any ? IS_REMOTE : `(${IS_REMOTE} and ${inTargets})`;
  const location = `case
    when ${inTargets} and (${prefs.remote === "remote_only" ? IS_REMOTE : "true"}) then null
    when ${remoteInReach} then null
    when ${IS_REMOTE} and not ${HAS_COUNTRY} and ${remoteOk} then 'remote, country unknown'
    when not ${IS_REMOTE} and ${prefs.remote === "remote_only" ? "true" : "false"} then 'not remote'
    else 'not in target countries' end`;

  // Relocation: with "no", an on site role passes only in the countries the
  // user will work on site in.
  const relocation =
    prefs.relocation === "no"
      ? `case when not ${IS_REMOTE} and not exists (select 1 from ${LOC} where l->>'country' in ${list(prefs.onsiteCountries ?? [])}) then 'relocation' end`
      : "null";

  // Stated restrictions. The user meets one through an authorization fact in
  // the restriction's country; with no country named, the job's own countries.
  const meets = (countries: string[]) =>
    `coalesce(j.eligibility_country in ${list(countries)}, exists (select 1 from ${LOC} where l->>'country' in ${list(countries)}))`;
  const citizens = auth.filter((a) => a.basis === "citizen").map((a) => a.country);
  const residents = auth.filter((a) => a.basis === "citizen" || a.basis === "permanent_resident").map((a) => a.country);
  const authorised = auth.filter((a) => a.basis !== "none").map((a) => a.country);
  const restriction = `case
    when j.eligibility = 'clearance' then 'needs a security clearance, Jobluvo does not handle these'
    when j.eligibility = 'citizenship' and not ${meets(citizens)} then 'citizenship required'
    when j.eligibility = 'permanent_residency' and not ${meets(residents)} then 'permanent residency required'
    when j.eligibility = 'right_to_work' and not ${meets(authorised)} then 'right to work required'
    end`;

  // Sponsorship: needed now, no authorization in the job's country, posting says no.
  const sponsorshipRule =
    sponsorship?.now
      ? `case when j.sponsorship = 'not_offered'
              and not exists (select 1 from ${LOC} where l->>'country' in ${list(authorised)})
              then 'sponsorship not offered' end`
      : "null";

  const employment = prefs.employmentTypes?.length
    ? `case when j.employment_type is not null and j.employment_type not in ${list(prefs.employmentTypes)} then 'employment type' end`
    : "null";

  const excluded = prefs.excludedCompanies?.length
    ? `case when lower(j.company_name) in ${list(prefs.excludedCompanies.map((c) => c.toLowerCase()))} then 'excluded company' end`
    : "null";

  return `coalesce(${location}, ${relocation}, ${restriction}, ${sponsorshipRule}, ${employment}, ${excluded})`;
}
