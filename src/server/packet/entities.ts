import type { PacketFinding } from "@/db/schema";
import { GENERIC_OBJECTS, lemma } from "./claims";
import { normaliseNumbers } from "./normalise";

/*
 * The non numeric check (review three finding 3, D-022): a line may reword
 * a fact, it may not assert a new entity, qualification or responsibility.
 * The line between the two is drawn by signals on the token, not by
 * whether the word appears in a fact:
 *
 *   form            an internal capital, all caps, punctuation inside, or
 *                   letters with digits: KPI, C++, .NET, B2B
 *   proper          capitalised in the middle of a sentence
 *   sentence start  the first word of a sentence, when it is not a verb the
 *                   resume style uses and does not end in "ed" or "ing"
 *   posting         a noun shaped word the job posting uses and the profile
 *                   does not, the model reaching into the job description,
 *                   and only where it stands in a claim position: inside the
 *                   object of a responsibility or creation verb. "Set up
 *                   feedback loops" claims loops; "with attention to detail"
 *                   is the posting's vocabulary in a rewording, which is
 *                   what tailoring is for (D-023)
 *   object          the head noun of the object of a responsibility or
 *                   creation verb: "Led recruitment of analysts" claims
 *                   recruitment
 *
 * Entity existence and relationship support are two questions (review four,
 * finding 6). The first four signals ask whether the entity exists on the
 * profile: an entity the user owns nowhere is held. A token in a claim
 * position, the object of a responsibility verb or the instrument after it
 * ("built dashboards in Excel", "using Salesforce"), then asks whether the
 * cited facts support the relationship: an object head, an instrument head
 * or an entity there must be in a fact the line cites, the same principle
 * as the employer rule. A global match never answers the second question:
 * "Built dashboards in Salesforce" under the Excel role is held however
 * well the user knows Salesforce, and "Led RECRUITMENT" is held exactly as
 * "Led recruitment" is. Objects that name no domain, "present progress",
 * are exempt. A coordinated object is every conjunct, "dashboards and
 * recruitment systems" claims systems as well (finding 5B), and a
 * qualification word, "certified", "licensed", is a claim wherever it
 * stands (5C).
 *
 * Every finding names the token that fired and, for a claim position, the
 * word the cited fact uses in its place, so a person clears it in a glance.
 */

export interface Token {
  raw: string;
  low: string;
  sentenceStart: boolean;
  /** The token was followed by a comma, colon, full stop or the like. */
  endsClause: boolean;
}

export function tokensOf(text: string): Token[] {
  const out: Token[] = [];
  let start = true;
  // A hyphenated compound is one word, "trade-offs", "cross-team"; the number normaliser opens hyphens, this does not.
  for (const piece of text.replace(/[–—]/g, " ").split(/\s+/)) {
    const m = /^[("']*(.*?)[)"',;:.!?]*$/.exec(piece);
    let core = m?.[1] ?? piece;
    if (!/^\.net$/i.test(core)) core = core.replace(/^\.+/, "");
    if (core) out.push({ raw: core, low: core.toLowerCase(), sentenceStart: start, endsClause: /[,;:.!?)]$/.test(piece) });
    start = /[.!?;:]$/.test(piece);
  }
  return out;
}

export const FUNCTION_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "of", "to", "in", "for", "with", "at", "on", "by", "from", "as", "into", "onto", "over", "under", "across",
  "within", "through", "throughout", "via", "per", "than", "that", "this", "these", "those", "which", "who", "whom", "whose", "while", "where", "when",
  "is", "are", "was", "were", "be", "been", "being", "has", "have", "had", "do", "does", "did", "it", "its", "their", "our", "his", "her", "we", "i", "my",
  "me", "us", "they", "them", "up", "down", "out", "off", "not", "no", "so", "if", "then", "also", "both", "each", "all", "any", "some", "such",
  "including", "using", "about", "around", "between", "among", "against", "versus", "vs", "before", "after", "during", "since", "until", "till", "now", "twice", "once",
]);

/** Verbs whose object is a responsibility or a thing made. The object's head noun must be in a cited fact. */
export const RESPONSIBILITY_VERBS = new Set([
  "led", "lead", "leading", "leads", "managed", "manage", "managing", "manages", "owned", "own", "owning", "owns", "ran", "run", "running", "runs",
  "headed", "head", "heading", "heads", "oversaw", "oversee", "overseeing", "oversees", "drove", "drive", "driving", "drives", "handled", "handle", "handling",
  "directed", "direct", "directing", "coordinated", "coordinate", "coordinating", "supervised", "supervise", "supervising", "delivered", "deliver", "delivering", "delivers",
  "built", "build", "building", "builds", "developed", "develop", "developing", "designed", "design", "designing", "created", "create", "creating",
  "launched", "launch", "launching", "implemented", "implement", "implementing", "established", "establish", "establishing", "set", "recruited", "recruit", "recruiting",
  "hired", "hire", "hiring", "negotiated", "negotiate", "negotiating", "executed", "execute", "executing", "spearheaded", "championed", "championing", "orchestrated", "steered",
  "automated", "automate", "automating", "prepared", "prepare", "preparing", "presented", "present", "presenting", "screened", "screen", "screening",
  "sized", "size", "sizing", "maintained", "maintain", "maintaining", "redesigned", "redesign", "coached", "coach", "coaching", "reported", "report", "reporting",
  // Third person, the summary's voice: "who builds operating systems, develops teams".
  "develops", "designs", "creates", "launches", "implements", "establishes", "sets", "recruits", "hires", "negotiates", "executes", "automates", "prepares", "presents",
  "screens", "sizes", "maintains", "redesigns", "coaches", "reports", "owns", "manages", "leads", "runs", "heads", "oversees", "drives", "handles", "directs", "coordinates", "supervises", "delivers", "builds",
]);

/**
 * The summary claims without a verb: "experience in", "experienced in",
 * "expertise in", "skilled in", "background in". What follows is a claim
 * position like a verb's object, and a posting noun there is held.
 */
export const CLAIM_OPENERS = new Set(["experience", "experienced", "expertise", "skilled", "background", "proficient", "specialising", "specializing", "specialist", "track", "record"]);
const PARTICLES = new Set(["up", "out", "off", "down", "over", "through"]);
/** After an object, the instrument it was done with: "built dashboards in Excel", "using Salesforce", "on Jira". A claim position (finding 5A). */
const INSTRUMENT_PREPOSITIONS = new Set(["using", "via", "in", "on", "through"]);
/** "with" opens an instrument only for a token that carries an entity signal: "with Salesforce" is a claim, "with attention to detail" is a rewording. */
const WEAK_INSTRUMENT = "with";
/** Words an instrument head cannot be: time and place words after "in" are not tools. */
const NOT_INSTRUMENT = new Set(["year", "years", "month", "months", "week", "weeks", "day", "days", "quarter", "quarters", "time", "line", "place", "parallel", "house", "person", "charge", "role", "roles", "order", "turn", "advance", "total", "full", "part", "particular", "practice", "scope", "detail", "response", "support", "partnership", "collaboration", "conjunction", "tandem", "front", "return", "data", "information", "input", "inputs", "way", "ways", "manner", "terms", "form", "format", "formats"]);
/** Qualification words: a claim wherever they stand (finding 5C). Supported by a profile lemma that starts the same way. */
const QUALIFICATION_STEMS = ["certif", "licens", "licenc", "accredit", "charter", "credential", "diploma", "fellow", "qualif"];
export const qualificationStem = (low: string): string | null => QUALIFICATION_STEMS.find((q) => low.startsWith(q)) ?? null;

export { GENERIC_OBJECTS };

const CURRENCIES = new Set(["usd", "eur", "gbp", "cad", "try", "us"]);
const isValue = (low: string) => /^\d/.test(low);

/** Light verbs and plain adjectives with no telling ending. Closed class, like the function words: a posting cannot add to it. */
const LIGHT_WORDS = new Set([
  "use", "uses", "need", "needs", "make", "makes", "get", "gets", "keep", "keeps", "take", "takes", "give", "gives", "help", "helps", "ensure", "ensures", "meet", "meets",
  "see", "sees", "want", "wants", "bring", "brings", "put", "puts", "let", "lets",
  "clear", "complex", "key", "new", "old", "high", "low", "strong", "weak", "deep", "broad", "wide", "senior", "junior", "cross", "multi", "end", "top", "best", "better", "good",
  "great", "own", "full", "fast", "quick", "simple", "hard", "soft", "long", "short", "small", "large", "big", "main", "core", "prior", "next", "same", "other", "many", "few",
]);

/** Noun shaped, as far as an ending can tell: not a verb the resume style uses, not a verb, adjective or adverb by its suffix, not a light word, and not a generic object. */
export const nounShaped = (low: string): boolean =>
  low.length >= 3 && !RESPONSIBILITY_VERBS.has(low) && !LIGHT_WORDS.has(low) && !/(ing|ed|ly|able|ible|ive|ous|ful|less|ic|al|ise|ize|ify)$/.test(low) && !GENERIC_OBJECTS.has(low);

/** The content lemmas of a text: what "on the profile", "in the cited facts" and "in the posting" mean. */
export function lemmasOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of normaliseNumbers(text.replace(/(\w)-(\w)/g, "$1‑$2")).replace(/‑/g, "-").split(/[^a-z0-9+#.-]+/)) {
    const core = /^\.net$/.test(t) ? t : t.replace(/^\.+|\.+$/g, "");
    if (core && /[a-z]/.test(core) && !FUNCTION_WORDS.has(core)) out.add(lemma(core));
  }
  return out;
}

export type EntitySignal = "form" | "proper" | "sentence start" | "posting" | "object" | "instrument" | "qualification";

/** Where a posting noun counts: "claim", inside the object of a responsibility verb, the rule; "anywhere", the earlier rule, kept for the measurement. */
export type PostingScope = "claim" | "anywhere";

export interface EntityToken {
  token: string;
  /** The token as it is looked up. */
  key: string;
  signals: EntitySignal[];
  /** For an object, the verb it is the object of. */
  verb?: string;
  /** The token stands in a claim position: inside the object of a responsibility verb, or the instrument after it. */
  claim: boolean;
  /** The claim position is the instrument after the verb, strong or weak, so a finding's hint is the cited fact's instrument. */
  instrument: boolean;
}

const isForm = (raw: string) => /^[A-Za-z][a-z]*[A-Z]/.test(raw) || (/^[A-Z]{2,6}$/.test(raw) && raw.length <= 6) || /[+#]|\.[a-z]/i.test(raw) || (/\d/.test(raw) && /[a-z]/i.test(raw));

const isContentToken = (t: Token) => !FUNCTION_WORDS.has(t.low) && !isValue(t.low) && !RESPONSIBILITY_VERBS.has(t.low) && !CURRENCIES.has(t.low) && /[a-z]/i.test(t.raw);

/**
 * The object after the verb at `i`, as conjunct runs: "dashboards and
 * recruitment systems" is two runs, each with its own head. A run is the
 * indices of its content words up to a function word, a value or
 * punctuation, articles skipped; "and" or "or" followed by a content word
 * starts the next conjunct. Then the instrument, when one follows: the run
 * after "using", "via", "in", "on" or "through", and after "with" only as
 * `weak`, where a token counts when it carries an entity signal.
 */
export interface ObjectRuns {
  objects: number[][];
  instrument: number[];
  weak: boolean;
}

export function objectRuns(toks: Token[], i: number): ObjectRuns {
  const objects: number[][] = [];
  let run: number[] = [];
  let j = i + 1;
  let ended = false;
  for (; j < toks.length; j += 1) {
    const w = toks[j].low;
    if (toks[j - 1].endsClause) break;
    // "set up", "rolled out", "experience in": the particle or preposition right after the opener is part of it.
    if (j === i + 1 && (PARTICLES.has(w) || ((w === "in" || w === "with" || w === "of") && CLAIM_OPENERS.has(toks[i].low)))) continue;
    if (w === "a" || w === "an" || w === "the") continue;
    // "and recruitment systems" is a second conjunct; "and partnered with" is a second predicate, its past tense says so.
    if ((w === "and" || w === "or") && run.length && j + 1 < toks.length && isContentToken(toks[j + 1]) && !/ed$/.test(toks[j + 1].low) && !toks[j - 1].endsClause) {
      objects.push(run);
      run = [];
      continue;
    }
    if (!isContentToken(toks[j])) {
      ended = true;
      break;
    }
    run.push(j);
    if (toks[j].endsClause) {
      j += 1;
      ended = true;
      break;
    }
  }
  if (run.length) objects.push(run);
  const instrument: number[] = [];
  let weak = false;
  // The instrument follows the object directly: "built dashboards in Excel", never "in" three clauses later.
  if (objects.length && ended && j < toks.length && !toks[j - 1].endsClause) {
    const p = toks[j].low;
    if (INSTRUMENT_PREPOSITIONS.has(p) || p === WEAK_INSTRUMENT) {
      weak = p === WEAK_INSTRUMENT;
      for (let k = j + 1; k < toks.length; k += 1) {
        const w = toks[k].low;
        if (w === "a" || w === "an" || w === "the") continue;
        if (!isContentToken(toks[k])) break;
        instrument.push(k);
        if (toks[k].endsClause) break;
      }
    }
  }
  return { objects, instrument, weak };
}

/** The claim positions after the verb at `i`: every object conjunct and the instrument, flat. Kept for the posting scope and the measurements. */
export function objectRun(toks: Token[], i: number): number[] {
  const r = objectRuns(toks, i);
  return [...r.objects.flat(), ...r.instrument];
}

/** The heads of the object after the verb at `i`: the last word of each conjunct run. */
export function objectHeads(toks: Token[], i: number): string[] {
  return objectRuns(toks, i).objects.map((run) => toks[run[run.length - 1]].raw);
}

/** The head of the first object after the verb at `i`. */
export function objectHead(toks: Token[], i: number): string | null {
  return objectHeads(toks, i)[0] ?? null;
}

/** The head of the instrument after the verb at `i`, when the instrument is a strong one and its head can be a tool: "Excel" in "built dashboards in Excel". */
export function instrumentHead(toks: Token[], i: number): string | null {
  const r = objectRuns(toks, i);
  if (!r.instrument.length || r.weak) return null;
  const head = toks[r.instrument[r.instrument.length - 1]];
  return NOT_INSTRUMENT.has(head.low) || GENERIC_OBJECTS.has(head.low) ? null : head.raw;
}

/** Every verb and object head in a text, for the hint a finding carries: "the cited fact says workstream". Instrument heads too, as their own verb "with". */
export function objectsOf(text: string): { verb: string; head: string }[] {
  const toks = tokensOf(text);
  const out: { verb: string; head: string }[] = [];
  toks.forEach((t, i) => {
    if (!RESPONSIBILITY_VERBS.has(t.low)) return;
    for (const head of objectHeads(toks, i)) out.push({ verb: lemma(t.low), head });
    const tool = instrumentHead(toks, i);
    if (tool) out.push({ verb: "with", head: tool });
  });
  return out;
}

/** The tokens of a line that assert something, each with the signals that say so. Pure; nothing is looked up. */
export function entityTokens(line: string, posting: Set<string>, profile: Set<string>, scope: PostingScope = "claim"): EntityToken[] {
  const toks = tokensOf(line);
  // Every index inside the object of a responsibility verb or the instrument after it: the claim positions. A weak instrument ("with ...")
  // is a claim position for a token with an entity signal only.
  const claim = new Set<number>();
  const weakClaim = new Set<number>();
  const instrumentTokens = new Set<number>();
  toks.forEach((t, i) => {
    if (RESPONSIBILITY_VERBS.has(t.low) || CLAIM_OPENERS.has(t.low)) {
      const r = objectRuns(toks, i);
      for (const j of r.objects.flat()) claim.add(j);
      for (const j of r.instrument) (r.weak ? weakClaim : claim).add(j);
      if (!r.weak) for (const j of r.instrument) instrumentTokens.add(j);
    }
  });
  const byKey = new Map<string, EntityToken>();
  const add = (signal: EntitySignal, token: string, inClaim: boolean, verb?: string, inInstrument = false) => {
    const key = lemma(token.toLowerCase().replace(/[^a-z0-9+#.-]/g, ""));
    if (!key) return;
    const had = byKey.get(key);
    if (had) {
      if (!had.signals.includes(signal)) had.signals.push(signal);
      if (verb && !had.verb) had.verb = verb;
      had.claim ||= inClaim;
      had.instrument ||= inInstrument;
      return;
    }
    byKey.set(key, { token, key, signals: [signal], claim: inClaim, instrument: inInstrument, ...(verb ? { verb } : {}) });
  };
  toks.forEach((t, i) => {
    const { raw, low } = t;
    if (FUNCTION_WORDS.has(low) || CURRENCIES.has(low) || isValue(low) || !/[a-z]/i.test(raw)) return;
    const key = lemma(low.replace(/[^a-z0-9+#.-]/g, ""));
    const inClaim = claim.has(i);
    const entitySignalled = isForm(raw) || (/^[A-Z]/.test(raw) && raw !== "I" && (!t.sentenceStart || (!RESPONSIBILITY_VERBS.has(low) && !/(ed|ing)$/.test(low))));
    const position = inClaim || (weakClaim.has(i) && entitySignalled);
    const inInstrument = instrumentTokens.has(i) || weakClaim.has(i);
    // A posting noun fires in a claim position: "set up feedback loops" claims loops and feedback, "implemented salesforce workflows" claims
    // salesforce, "built dashboards using salesforce data" claims salesforce. Outside one, "with attention to detail", it is the posting's
    // vocabulary in a rewording. The light words keep "complex analysis" out.
    if (nounShaped(low) && posting.has(key) && !profile.has(key) && (scope === "anywhere" || position)) add("posting", raw, position, undefined, inInstrument);
    if (isForm(raw)) add("form", raw, position, undefined, inInstrument);
    else if (/^[A-Z]/.test(raw) && !t.sentenceStart && raw !== "I") add("proper", raw, position, undefined, inInstrument);
    else if (/^[A-Z]/.test(raw) && t.sentenceStart && raw !== "I" && !RESPONSIBILITY_VERBS.has(low) && !/(ed|ing)$/.test(low)) add("sentence start", raw, position, undefined, inInstrument);
    if (qualificationStem(low)) add("qualification", raw, position, undefined, inInstrument);
    // A lower case tool in a strong instrument run, "using salesforce data", carries no entity signal; when the profile has it elsewhere it is
    // still a claim about this fact, so it enters as an instrument token and the cited facts decide (review four, 5A and 6).
    if (instrumentTokens.has(i) && !entitySignalled && profile.has(key) && nounShaped(low) && !NOT_INSTRUMENT.has(low)) add("instrument", raw, true, undefined, true);
    if (RESPONSIBILITY_VERBS.has(low)) {
      // A generic or light head, "present progress", "translating client needs", asserts nothing a fact could contradict.
      for (const head of objectHeads(toks, i)) if (!GENERIC_OBJECTS.has(head.toLowerCase()) && !LIGHT_WORDS.has(head.toLowerCase())) add("object", head, true, lemma(low));
      const tool = instrumentHead(toks, i);
      if (tool) add("instrument", tool, true, lemma(low), true);
    }
  });
  return [...byKey.values()];
}

export interface CitedFact {
  id: string;
  text: string;
}

/**
 * The findings the non numeric check makes on one line. `profile` is every
 * confirmed fact's lemmas, `posting` the job's, `cited` the facts the line
 * cites. Review, never hard: each names the token, and an object names the
 * word the cited fact uses in its place when one can be found.
 */
export function entityFindings(line: string, bullet: string | null, cited: CitedFact[], profile: Set<string>, posting: Set<string>, scope: PostingScope = "claim"): PacketFinding[] {
  const out: PacketFinding[] = [];
  const citedLemmas = lemmasOf(cited.map((c) => c.text).join("\n"));
  const citedObjects = cited.flatMap((c) => objectsOf(c.text));
  const profileHasStem = (stem: string) => [...profile].some((l) => l.startsWith(stem));
  for (const t of entityTokens(line, posting, profile, scope)) {
    const entity = t.signals.filter((s) => s !== "object" && s !== "instrument" && s !== "qualification");
    // First question: does the entity exist on the profile at all.
    if (entity.length && !profile.has(t.key)) {
      const why = entity.includes("form") ? "by its form" : entity.includes("proper") ? "capitalised" : entity.includes("sentence start") ? "opens the sentence and is not a verb" : "the posting uses it";
      out.push({
        level: "review",
        bullet,
        message: entity.every((s) => s === "posting") ? "word from the posting appears in no confirmed fact" : "name appears in no confirmed fact",
        value: t.token,
        detail: why,
      });
      continue;
    }
    if (t.signals.includes("qualification")) {
      const stem = qualificationStem(t.key) ?? qualificationStem(t.token.toLowerCase());
      if (stem && !profileHasStem(stem)) {
        out.push({ level: "review", bullet, message: "qualification appears in no confirmed fact", value: t.token, detail: "a certification or licence is a claim wherever it stands" });
        continue;
      }
    }
    // Second question, asked of every token in a claim position whatever the first answered: do the cited facts support the relationship.
    if (!t.claim || citedLemmas.has(t.key)) continue;
    // The hint is the cited fact's word in the same place: its instrument for an instrument, its object under the same verb otherwise.
    const same = citedObjects.find((o) => o.verb === t.verb);
    const tool = t.instrument ? citedObjects.find((o) => o.verb === "with") : undefined;
    const hint = tool ?? same ?? citedObjects[0];
    const says = hint ? `the cited fact says ${hint.head}` : "the cited facts name no object for it";
    if (t.signals.includes("object")) out.push({ level: "review", bullet, message: "responsibility is not in the cited facts", value: t.token, detail: says });
    else if (t.signals.includes("instrument")) out.push({ level: "review", bullet, message: "tool is not in the cited facts", value: t.token, detail: says });
    else if (entity.length) out.push({ level: "review", bullet, message: "entity is on the profile but not in the cited facts", value: t.token, detail: says });
  }
  return out;
}
