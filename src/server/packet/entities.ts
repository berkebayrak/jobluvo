import type { PacketFinding } from "@/db/schema";
import { GENERIC_OBJECTS, lemma } from "./claims";
import { normaliseNumbers } from "./normalise";

/*
 * Does a name the line uses exist on the profile at all.
 *
 * This module used to ask two questions. The first is whether an entity the
 * line names appears anywhere in the user's confirmed facts. The second was
 * whether the facts the line cites support the relationship it asserts: that
 * "Built dashboards in Salesforce" under the Excel role claims Salesforce for
 * that role however well the user knows it. The second question is a
 * comparison of what the line means against what a fact means, and it is gone
 * (D-034), along with the object heads, instrument heads and verb matching
 * that answered it. The prompt carries that duty now.
 *
 * The first question stays, profile wide, and a token is looked up when a
 * signal on it says it is a name rather than ordinary prose:
 *
 *   form            an internal capital, all caps, punctuation inside, or
 *                   letters with digits: KPI, C++, .NET, B2B
 *   proper          capitalised in the middle of a sentence
 *   sentence start  the first word of a sentence, when it is not a verb the
 *                   resume style uses and does not end in "ed" or "ing"
 *   posting         a noun shaped word the job posting uses and the profile
 *                   does not, the model reaching into the job description
 *   qualification   "certified", "licensed", a claim wherever it stands
 *
 * The posting signal keeps its claim position scope, and that is a deliberate
 * exception to the removal. The scope decides which tokens are looked up, not
 * what any of them means, and without it the rule fires on ordinary rewording:
 * "with attention to detail" is the posting's vocabulary in a rewording, which
 * is what tailoring is for, while "set up feedback loops" claims loops
 * (D-023, measured at eight in ten against one in four). The machinery kept
 * for it is objectRuns and nothing else.
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

/** Verbs whose object is a responsibility or a thing made. Kept for the claim position scope and for the noun shape test. */
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
  // Verbs whose past tense ends in neither "ed" nor "ing", so the sentence start rule cannot tell them from a name by their shape.
  // While these findings were held this list being short cost a hold; now that they reject the packet it costs a truthful line,
  // and "Cut operating cost 11 percent" is as ordinary as a resume line gets (D-034).
  "cut", "cuts", "cutting", "grew", "grow", "grows", "growing", "won", "win", "wins", "sold", "sell", "sells", "selling",
  "wrote", "write", "writes", "writing", "kept", "keep", "keeps", "met", "meet", "meets", "held", "hold", "holds", "holding",
  "took", "take", "takes", "taking", "made", "make", "makes", "making", "brought", "bring", "brings", "taught", "teach", "teaches",
  "spent", "spend", "spends", "began", "begin", "begins", "chose", "choose", "chooses", "gave", "give", "gives", "saw", "see", "sees",
  "rose", "rise", "rises", "fell", "fall", "falls", "cut-over", "rebuilt", "rebuild", "rebuilds",
]);

/**
 * The summary claims without a verb: "experience in", "experienced in",
 * "expertise in", "skilled in", "background in". What follows is a claim
 * position like a verb's object.
 */
export const CLAIM_OPENERS = new Set(["experience", "experienced", "expertise", "skilled", "background", "proficient", "specialising", "specializing", "specialist", "track", "record"]);
const PARTICLES = new Set(["up", "out", "off", "down", "over", "through"]);
/** After an object, the instrument it was done with: "built dashboards in Excel", "using Salesforce", "on Jira". A claim position. */
const INSTRUMENT_PREPOSITIONS = new Set(["using", "via", "in", "on", "through"]);
/** "with" opens an instrument only for a token that carries an entity signal: "with Salesforce" is a claim, "with attention to detail" is a rewording. */
const WEAK_INSTRUMENT = "with";
/** Qualification words: a claim wherever they stand. Supported by a profile lemma that starts the same way. */
const QUALIFICATION_STEMS = ["certif", "licens", "licenc", "accredit", "charter", "credential", "diploma", "fellow", "qualif"];
export const qualificationStem = (low: string): string | null => QUALIFICATION_STEMS.find((q) => low.startsWith(q)) ?? null;

export { GENERIC_OBJECTS };

const CURRENCIES = new Set(["usd", "eur", "gbp", "cad", "try", "us"]);
/**
 * Month names are part of a date, which claims.ts reads as a value. This
 * tokeniser does not see values, so without this "March 2022" offers "March"
 * as a capitalised word in no fact and the line is rejected. Harmless while
 * these findings were held for a person; not harmless now that they reject
 * the packet (D-034).
 */
const MONTH_WORDS = new Set([
  "jan", "january", "feb", "february", "mar", "march", "apr", "april", "may", "jun", "june",
  "jul", "july", "aug", "august", "sep", "sept", "september", "oct", "october", "nov", "november", "dec", "december",
]);
/**
 * A token the value reader already owns: a number, or an amount written with
 * its currency in front, "$1.1B". Without the second form the amount reads as
 * a name by its form, letters with digits, and rejects a truthful line.
 */
const isValue = (low: string) => /^\d/.test(low) || /^(?:\$|€|£|usd|us\$|eur|gbp|cad|try)[\d.]/.test(low);

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

/** The content lemmas of a text: what "on the profile" and "in the posting" mean. */
export function lemmasOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of normaliseNumbers(text.replace(/(\w)-(\w)/g, "$1‑$2")).replace(/‑/g, "-").split(/[^a-z0-9+#.-]+/)) {
    const core = /^\.net$/.test(t) ? t : t.replace(/^\.+|\.+$/g, "");
    if (core && /[a-z]/.test(core) && !FUNCTION_WORDS.has(core)) out.add(lemma(core));
  }
  return out;
}

export type EntitySignal = "form" | "proper" | "sentence start" | "posting" | "qualification";

/** Where a posting noun counts: "claim", inside the object of a responsibility verb, the rule; "anywhere", the earlier rule, kept for the measurement. */
export type PostingScope = "claim" | "anywhere";

export interface EntityToken {
  token: string;
  /** The token as it is looked up. */
  key: string;
  signals: EntitySignal[];
}

const isForm = (raw: string) => /^[A-Za-z][a-z]*[A-Z]/.test(raw) || (/^[A-Z]{2,6}$/.test(raw) && raw.length <= 6) || /[+#]|\.[a-z]/i.test(raw) || (/\d/.test(raw) && /[a-z]/i.test(raw));

const isContentToken = (t: Token) => !FUNCTION_WORDS.has(t.low) && !isValue(t.low) && !RESPONSIBILITY_VERBS.has(t.low) && !CURRENCIES.has(t.low) && /[a-z]/i.test(t.raw);

/**
 * The object after the verb at `i`, as conjunct runs, and the instrument that
 * follows it. The only thing read from this now is which token indices sit in
 * a claim position, which scopes the posting rule.
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

/** The tokens of a line that name something, each with the signals that say so. Pure; nothing is looked up. */
export function entityTokens(line: string, posting: Set<string>, profile: Set<string>, scope: PostingScope = "claim"): EntityToken[] {
  const toks = tokensOf(line);
  // Every index inside the object of a responsibility verb or the instrument after it: the claim positions, which scope the posting rule.
  // A weak instrument ("with ...") is a claim position for a token with an entity signal only.
  const claim = new Set<number>();
  const weakClaim = new Set<number>();
  toks.forEach((t, i) => {
    if (RESPONSIBILITY_VERBS.has(t.low) || CLAIM_OPENERS.has(t.low)) {
      const r = objectRuns(toks, i);
      for (const j of r.objects.flat()) claim.add(j);
      for (const j of r.instrument) (r.weak ? weakClaim : claim).add(j);
    }
  });
  const byKey = new Map<string, EntityToken>();
  const add = (signal: EntitySignal, token: string) => {
    const key = lemma(token.toLowerCase().replace(/[^a-z0-9+#.-]/g, ""));
    if (!key) return;
    const had = byKey.get(key);
    if (had) {
      if (!had.signals.includes(signal)) had.signals.push(signal);
      return;
    }
    byKey.set(key, { token, key, signals: [signal] });
  };
  toks.forEach((t, i) => {
    const { raw, low } = t;
    if (FUNCTION_WORDS.has(low) || CURRENCIES.has(low) || MONTH_WORDS.has(low) || isValue(low) || !/[a-z]/i.test(raw)) return;
    const key = lemma(low.replace(/[^a-z0-9+#.-]/g, ""));
    const entitySignalled = isForm(raw) || (/^[A-Z]/.test(raw) && raw !== "I" && (!t.sentenceStart || (!RESPONSIBILITY_VERBS.has(low) && !/(ed|ing)$/.test(low))));
    const position = claim.has(i) || (weakClaim.has(i) && entitySignalled);
    // A posting noun fires in a claim position: "set up feedback loops" claims loops, "implemented salesforce workflows" claims salesforce.
    // Outside one, "with attention to detail", it is the posting's vocabulary in a rewording. The light words keep "complex analysis" out.
    if (nounShaped(low) && posting.has(key) && !profile.has(key) && (scope === "anywhere" || position)) add("posting", raw);
    if (isForm(raw)) add("form", raw);
    else if (/^[A-Z]/.test(raw) && !t.sentenceStart && raw !== "I") add("proper", raw);
    else if (/^[A-Z]/.test(raw) && t.sentenceStart && raw !== "I" && !RESPONSIBILITY_VERBS.has(low) && !/(ed|ing)$/.test(low)) add("sentence start", raw);
    if (qualificationStem(low)) add("qualification", raw);
  });
  return [...byKey.values()];
}

/**
 * The findings on one line: a name, or a qualification, that appears nowhere
 * in the user's confirmed facts. `profile` is every confirmed fact's lemmas,
 * `posting` the job's. Hard: the user's rule is that a value or an entity in
 * no confirmed fact rejects the packet (D-034).
 */
export function entityFindings(line: string, bullet: string | null, profile: Set<string>, posting: Set<string>, scope: PostingScope = "claim"): PacketFinding[] {
  const out: PacketFinding[] = [];
  const profileHasStem = (stem: string) => [...profile].some((l) => l.startsWith(stem));
  for (const t of entityTokens(line, posting, profile, scope)) {
    const entity = t.signals.filter((s) => s !== "qualification");
    if (entity.length && !profile.has(t.key)) {
      const why = entity.includes("form") ? "by its form" : entity.includes("proper") ? "capitalised" : entity.includes("sentence start") ? "opens the sentence and is not a verb" : "the posting uses it";
      out.push({
        level: "hard",
        code: entity.every((s) => s === "posting") ? "posting-word-unknown" : "name-unknown",
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
        out.push({ level: "hard", bullet, code: "qualification-unsupported", message: "qualification appears in no confirmed fact", value: t.token, detail: "a certification or licence is a claim wherever it stands" });
      }
    }
  }
  return out;
}
