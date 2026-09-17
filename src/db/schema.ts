import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Phase 0 schema: discovery, profile facts, matches and the cost worksheet.
 * Packets arrive with the packet pull request.
 *
 * Every timestamp is timestamptz. Ids are uuids. Enums are Postgres enums so
 * the database rejects a value the code does not know.
 */

export const familyEnum = pgEnum("family", [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
  "gem",
]);

export const workplaceEnum = pgEnum("workplace", ["remote", "hybrid", "onsite", "unknown"]);
export const compPeriodEnum = pgEnum("comp_period", ["year", "month", "hour", "unknown"]);
export const sponsorshipEnum = pgEnum("sponsorship", ["offered", "not_offered", "unknown"]);
export const restrictionEnum = pgEnum("restriction", ["citizenship", "permanent_residency", "right_to_work", "clearance"]);
export const linkReasonEnum = pgEnum("link_reason", ["native", "url", "requisition", "similar"]);
export const decisionEnum = pgEnum("decision", ["apply", "save", "skip"]);
export const costKindEnum = pgEnum("cost_kind", ["ingest", "extract", "score", "tailor"]);
export const matchStatusEnum = pgEnum("match_status", ["pending", "scored", "failed"]);
export const packetStatusEnum = pgEnum("packet_status", ["ready", "needs_review", "invalid", "failed"]);
export const factKindEnum = pgEnum("fact_kind", [
  "contact",
  "link",
  "employment",
  "education",
  "project",
  "skill",
  "authorization",
  "sponsorship",
  "preference",
  "answer",
]);
export const factOriginEnum = pgEnum("fact_origin", ["upload", "user", "edit"]);
export const factStatusEnum = pgEnum("fact_status", ["extracted", "confirmed", "rejected"]);
/** Where an uploaded document's extraction stands: the call is running, it returned, or it failed. */
export const documentStatusEnum = pgEnum("document_status", ["processing", "ready", "failed"]);

export type Family = (typeof familyEnum.enumValues)[number];

export interface JobLocation {
  city?: string;
  region?: string;
  /** ISO 3166 alpha 2. */
  country?: string;
  /** The feed's country name when it is not in the code table; `country` stays empty. */
  countryName?: string;
  remote?: boolean;
  raw: string;
}

/** The tailored resume as the packet renders it. Every id points at a confirmed fact (src/server/packet/resume.ts). */
export interface ResumeDocument {
  summary: string | null;
  experience: { id: string; heading: string; bullets: { id: string; text: string }[] }[];
  education: { id: string; text: string }[];
  skills: { id: string; text: string }[];
}

/** One edit the model proposed: the bullet it replaces, the new text, and the facts it says support it. */
export interface ResumeChange {
  bullet: string;
  text: string;
  facts: string[];
}

/**
 * What the validator found. "hard" rejects the packet, one retry then
 * invalid. "review" holds the packet for a person: the validator could not
 * read one side, or a name is in no fact; no retry, because a retry cannot
 * resolve an unknown, it can only make the model drop the line, an
 * omission with nobody deciding it. "soft" is shown with the packet.
 */
export interface PacketFinding {
  level: "hard" | "review" | "soft";
  bullet: string | null;
  message: string;
  value?: string;
  /** What the check saw on each side, for the review screen: the fact's reading against the line's. */
  detail?: string;
  /** For a value the line took from a fact the user typed rather than the resume's words. */
  origin?: "upload" | "user" | "edit";
}

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  jobluvoAddress: text("jobluvo_address").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    family: familyEnum("family").notNull(),
    /** Board token, site, org, company, account or vanity path, per family. */
    tenant: text("tenant").notNull(),
    companyName: text("company_name").notNull(),
    companyDomain: text("company_domain"),
    active: boolean("active").notNull().default(true),
    etag: text("etag"),
    /** Written by the claim only, and the claim's ordering key. */
    lastAttemptAt: ts("last_attempt_at"),
    /** Written when a poll finishes, 200 or 304. An attempt with no later success is a poll that died. */
    lastSuccessAt: ts("last_success_at"),
    /** polling while claimed, then ok, not_modified, failed or paused. A stale "polling" is a killed function. */
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    jobCount: integer("job_count").notNull().default(0),
    /** Bumped whenever the detected boilerplate set changes. Jobs carry the version they were hashed under. */
    boilerplateVersion: integer("boilerplate_version").notNull().default(0),
    boilerplate: jsonb("boilerplate").$type<string[]>().notNull().default([]),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sources_family_tenant").on(t.family, t.tenant)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    family: familyEnum("family").notNull(),
    nativeId: text("native_id").notNull(),
    requisitionId: text("requisition_id"),
    title: text("title").notNull(),
    titleNorm: text("title_norm").notNull(),
    companyName: text("company_name").notNull(),
    companyDomain: text("company_domain"),
    locations: jsonb("locations").$type<JobLocation[]>().notNull().default([]),
    workplace: workplaceEnum("workplace").notNull().default("unknown"),
    employmentType: text("employment_type"),
    compMin: integer("comp_min"),
    compMax: integer("comp_max"),
    compCurrency: text("comp_currency"),
    compPeriod: compPeriodEnum("comp_period").notNull().default("unknown"),
    /** The salary text as the board gave it, so the numbers can be reparsed without fetching again. */
    compRaw: text("comp_raw"),
    seniority: text("seniority"),
    sponsorship: sponsorshipEnum("sponsorship").notNull().default("unknown"),
    sponsorshipEvidence: text("sponsorship_evidence"),
    /** A stated eligibility restriction, separate from sponsorship, with the sentence as evidence. Null when the posting says nothing. */
    eligibility: restrictionEnum("eligibility"),
    /** Alternatives of conjunctions: one inner list must be met in full. Null when the posting says nothing. */
    eligibilityOptions: jsonb("eligibility_options").$type<string[][]>(),
    eligibilityCountry: text("eligibility_country"),
    eligibilityEvidence: text("eligibility_evidence"),
    descriptionText: text("description_text").notNull().default(""),
    descriptionHtml: text("description_html").notNull().default(""),
    /** description_text with the source's boilerplate removed; what hashing and similarity read. */
    descriptionCore: text("description_core").notNull().default(""),
    /** sha256 over title, locations and description_core. */
    contentHash: text("content_hash").notNull(),
    boilerplateVersion: integer("boilerplate_version").notNull().default(0),
    applyUrl: text("apply_url").notNull(),
    applyUrlNorm: text("apply_url_norm").notNull(),
    postedAt: ts("posted_at"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastCheckedAt: ts("last_checked_at").notNull().defaultNow(),
    /** Consecutive 200 polls in which the job was absent. A 304 never touches it. */
    missedPolls: integer("missed_polls").notNull().default(0),
    closedAt: ts("closed_at"),
    /** SmartRecruiters only: the list entry is stored, the detail body is still to fetch. */
    detailPending: boolean("detail_pending").notNull().default(false),
    /** Hash of the list level entry, so a detail is refetched only when the list entry changed. */
    listHash: text("list_hash"),
  },
  (t) => [
    uniqueIndex("jobs_family_source_native").on(t.family, t.sourceId, t.nativeId),
    index("jobs_apply_url_norm").on(t.applyUrlNorm),
    index("jobs_company_domain").on(t.companyDomain),
    index("jobs_title_norm").on(t.titleNorm),
    index("jobs_source_open").on(t.sourceId, t.closedAt),
  ],
);

export const jobGroups = pgTable("job_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalJobId: uuid("canonical_job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** The only record of group membership. A job is in at most one group. */
export const jobGroupLinks = pgTable(
  "job_group_links",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => jobGroups.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    reason: linkReasonEnum("reason").notNull(),
    score: real("score"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("job_group_links_job").on(t.jobId), index("job_group_links_group").on(t.groupId)],
);

/** Every near match at or above 0.6, merged or not, so the threshold is tuned on real data. */
export const similarityLog = pgTable("similarity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobA: uuid("job_a")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  jobB: uuid("job_b")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  score: real("score").notNull(),
  merged: boolean("merged").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const swipeDecisions = pgTable(
  "swipe_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    decision: decisionEnum("decision").notNull(),
    reason: text("reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  // One current decision per user and job; the route upserts on it, so a double tap is one row.
  (t) => [uniqueIndex("swipe_decisions_user_job").on(t.userId, t.jobId)],
);

/**
 * One row per user and job the scoring cron has claimed, unique on the pair.
 * The claim is two statements (src/server/match/claim.ts): an insert for
 * pairs that do not exist, then an update over rework rows. `attempts`
 * counts claims, the first included; a pair that failed three times takes
 * no further slot. The three hashes say what the score was computed from,
 * so the rework claim can tell a stale row from a current one without a
 * model call: prefs_hash over the preference fact, facts_hash over the
 * resume facts the prompt reads, content_hash copied from the job.
 */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: matchStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(1),
    /** 0 to 100. Null until scored. */
    score: integer("score"),
    band: text("band"),
    /** Short lines for the card. A line starting with "-" reads against. */
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    /** What the posting or the profile does not say and the score could not settle. */
    unknowns: jsonb("unknowns").$type<string[]>().notNull().default([]),
    prefsHash: text("prefs_hash").notNull(),
    factsHash: text("facts_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    claimedAt: ts("claimed_at").notNull().defaultNow(),
    scoredAt: ts("scored_at"),
    model: text("model"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    usd: real("usd").notNull().default(0),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("matches_user_job").on(t.userId, t.jobId),
    index("matches_user_status").on(t.userId, t.status, t.claimedAt),
  ],
);

/**
 * One tailored resume for one user and job (DOC-01, DOC-03). The model
 * proposes edits against the confirmed facts, the code assembles the
 * document, and the validator decides whether it may be shown: a value
 * that appears in no confirmed fact rejects the packet, one retry, then
 * it is stored as invalid rather than passed. The three hashes bind the
 * packet to the facts, the job and the rendered text (DOC-05).
 */
export const packets = pgTable(
  "packets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: packetStatusEnum("status").notNull(),
    /** "changes": the model emitted edits and the code assembled the document. "document": the model emitted the whole resume. */
    mode: text("mode").notNull(),
    model: text("model").notNull(),
    /** Null for the product path. A sample tags its packets so the citation rate can be tracked per sample (D-013). */
    run: text("run"),
    attempts: integer("attempts").notNull().default(1),
    resume: jsonb("resume").$type<ResumeDocument>(),
    changes: jsonb("changes").$type<ResumeChange[]>().notNull().default([]),
    findings: jsonb("findings").$type<PacketFinding[]>().notNull().default([]),
    factsHash: text("facts_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    resumeHash: text("resume_hash"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensCached: integer("tokens_cached").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    usd: real("usd").notNull().default(0),
    ms: integer("ms").notNull().default(0),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("packets_user_job").on(t.userId, t.jobId)],
);

/** The observed cost worksheet. Model calls add tokens and usd; ingest adds time. */
export const costEvents = pgTable(
  "cost_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: costKindEnum("kind").notNull(),
    model: text("model"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    refId: text("ref_id"),
    tokensIn: integer("tokens_in").notNull().default(0),
    /** Of tokens_in, the part billed at the cached input rate. */
    tokensCached: integer("tokens_cached").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    usd: real("usd").notNull().default(0),
    ms: integer("ms").notNull().default(0),
    /** Null for the cron. A one off measurement tags its rows so the report can keep them apart (D-003). */
    run: text("run"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("cost_events_kind_created").on(t.kind, t.createdAt)],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * An uploaded resume. Storing the PDF in Postgres is a deliberate Phase 0
 * shortcut for one user; the column is named bytes_phase0 so the shortcut is
 * visible in every query that touches it. It moves to object storage before
 * any real user signs up.
 */
export const profileDocuments = pgTable("profile_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  bytesPhase0: bytea("bytes_phase0").notNull(),
  text: text("text").notNull(),
  pageCount: integer("page_count").notNull().default(0),
  /** Set to processing before the extraction call, ready when its facts are stored, failed when the call or the storing failed. */
  status: documentStatusEnum("status").notNull().default("processing"),
  /** Why it failed. A call of unknown cost leaves its mark here, so the cost report can count it (D-015). */
  error: text("error"),
  uploadedAt: ts("uploaded_at").notNull().defaultNow(),
});

/**
 * One fact about the user. `data` has one zod shape per kind, in
 * src/server/profile/facts.ts. A confirmed profile is the set of confirmed
 * facts; nothing downstream reads a fact that is not confirmed. Preference,
 * authorization and sponsorship facts are entered by the user, never taken
 * from a resume and never inferred from where the user lives.
 */
export const profileFacts = pgTable(
  "profile_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => profileDocuments.id, { onDelete: "set null" }),
    kind: factKindEnum("kind").notNull(),
    data: jsonb("data").notNull(),
    /** The span of the resume the fact came from, for upload origin facts. */
    evidence: text("evidence"),
    origin: factOriginEnum("origin").notNull(),
    status: factStatusEnum("status").notNull().default("extracted"),
    version: integer("version").notNull().default(1),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("profile_facts_user_kind").on(t.userId, t.kind, t.status)],
);

export type Source = typeof sources.$inferSelect;
export type ProfileFact = typeof profileFacts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Packet = typeof packets.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
