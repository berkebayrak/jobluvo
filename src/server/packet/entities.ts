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
 * The first four are checked against the whole profile: an entity the user
 * owns anywhere is theirs to place. The object is checked against the facts
 * the line cites, the same principle as the employer rule: a responsibility
 * is bound to the fact it claims to come from, and "managed analysts" with
 * the analysts borrowed from another role is the employer lie in another
 * shape. Objects that name no domain, "present progress", are exempt.
 *
 * Every finding names the token that fired and, for an object, the word the
 * cited fact uses in its place, so a person clears it in a glance.
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

export type EntitySignal = "form" | "proper" | "sentence start" | "posting" | "object";

/** Where a posting noun counts: "claim", inside the object of a responsibility verb, the rule; "anywhere", the earlier rule, kept for the measurement. */
export type PostingScope = "claim" | "anywhere";

export interface EntityToken {
  token: string;
  /** The token as it is looked up. */
  key: string;
  signals: EntitySignal[];
  /** For an object, the verb it is the object of. */
  verb?: string;
}

const isForm = (raw: string) => /^[A-Za-z][a-z]*[A-Z]/.test(raw) || (/^[A-Z]{2,6}$/.test(raw) && raw.length <= 6) || /[+#]|\.[a-z]/i.test(raw) || (/\d/.test(raw) && /[a-z]/i.test(raw));

/** The object after the verb at `i`: the indices of its run of content words up to a function word, a value or punctuation, articles skipped. */
export function objectRun(toks: Token[], i: number): number[] {
  const run: number[] = [];
  for (let j = i + 1; j < toks.length; j += 1) {
    const w = toks[j].low;
    if (toks[j - 1].endsClause) break;
    // "set up", "rolled out", "experience in": the particle or preposition right after the opener is part of it.
    if (j === i + 1 && (PARTICLES.has(w) || ((w === "in" || w === "with" || w === "of") && CLAIM_OPENERS.has(toks[i].low)))) continue;
    if (w === "a" || w === "an" || w === "the") continue;
    if (FUNCTION_WORDS.has(w) || isValue(w) || RESPONSIBILITY_VERBS.has(w) || CURRENCIES.has(w)) break;
    run.push(j);
    if (toks[j].endsClause) break;
  }
  return run;
}

/** The head of the object after the verb at `i`: the last word of its run. */
export function objectHead(toks: Token[], i: number): string | null {
  const run = objectRun(toks, i);
  return run.length ? toks[run[run.length - 1]].raw : null;
}

/** Every verb and object head in a text, for the hint a finding carries: "the cited fact says workstream". */
export function objectsOf(text: string): { verb: string; head: string }[] {
  const toks = tokensOf(text);
  const out: { verb: string; head: string }[] = [];
  toks.forEach((t, i) => {
    if (!RESPONSIBILITY_VERBS.has(t.low)) return;
    const head = objectHead(toks, i);
    if (head) out.push({ verb: lemma(t.low), head });
  });
  return out;
}

/** The tokens of a line that assert something, each with the signals that say so. Pure; nothing is looked up. */
export function entityTokens(line: string, posting: Set<string>, profile: Set<string>, scope: PostingScope = "claim"): EntityToken[] {
  const toks = tokensOf(line);
  // Every index inside the object of a responsibility verb: the claim positions.
  const claim = new Set<number>();
  toks.forEach((t, i) => {
    if (RESPONSIBILITY_VERBS.has(t.low) || CLAIM_OPENERS.has(t.low)) for (const j of objectRun(toks, i)) claim.add(j);
  });
  const byKey = new Map<string, EntityToken>();
  const add = (signal: EntitySignal, token: string, verb?: string) => {
    const key = lemma(token.toLowerCase().replace(/[^a-z0-9+#.-]/g, ""));
    if (!key) return;
    const had = byKey.get(key);
    if (had) {
      if (!had.signals.includes(signal)) had.signals.push(signal);
      if (verb && !had.verb) had.verb = verb;
      return;
    }
    byKey.set(key, { token, key, signals: [signal], ...(verb ? { verb } : {}) });
  };
  toks.forEach((t, i) => {
    const { raw, low } = t;
    if (FUNCTION_WORDS.has(low) || CURRENCIES.has(low) || isValue(low) || !/[a-z]/i.test(raw)) return;
    const key = lemma(low.replace(/[^a-z0-9+#.-]/g, ""));
    // A posting noun fires in a claim position: "set up feedback loops" claims loops and feedback, "implemented salesforce workflows" claims
    // salesforce. Outside one, "with attention to detail", it is the posting's vocabulary in a rewording. The light words keep "complex analysis" out.
    if (nounShaped(low) && posting.has(key) && !profile.has(key) && (scope === "anywhere" || claim.has(i))) add("posting", raw);
    if (isForm(raw)) add("form", raw);
    else if (/^[A-Z]/.test(raw) && !t.sentenceStart && raw !== "I") add("proper", raw);
    else if (/^[A-Z]/.test(raw) && t.sentenceStart && raw !== "I" && !RESPONSIBILITY_VERBS.has(low) && !/(ed|ing)$/.test(low)) add("sentence start", raw);
    if (RESPONSIBILITY_VERBS.has(low)) {
      const head = objectHead(toks, i);
      if (head && !GENERIC_OBJECTS.has(head.toLowerCase())) add("object", head, lemma(low));
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
  for (const t of entityTokens(line, posting, profile, scope)) {
    const entity = t.signals.filter((s) => s !== "object");
    // An entity is checked against the profile, and an entity the user owns anywhere is theirs to place, even as the object of a verb.
    if (entity.length && profile.has(t.key)) continue;
    if (entity.length) {
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
    if (t.signals.includes("object") && !citedLemmas.has(t.key)) {
      const same = citedObjects.find((o) => o.verb === t.verb);
      const hint = same ?? citedObjects[0];
      out.push({
        level: "review",
        bullet,
        message: "responsibility is not in the cited facts",
        value: t.token,
        detail: hint ? `the cited fact says ${hint.head}` : "the cited facts name no object for it",
      });
    }
  }
  return out;
}
