"use client";

import * as React from "react";
import { Rows3 } from "lucide-react";

import {
  Banner,
  Button,
  Card,
  ChatBubble,
  InboxRow,
  Input,
  JobCard,
  KanbanCard,
  Modal,
  Select,
  StatTile,
  StatusTag,
  SwipeCard,
  TableRow,
  ToastPill,
  Toggle,
  TopNav,
  showToast,
  STATUS,
  type Status,
} from "@/components";

/* ---------------------------------------------------------------- layout -- */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-lg)",
            lineHeight: "var(--leading-lg)",
            fontWeight: 500,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-sm)",
            color: "var(--fg-subtle)",
          }}
        >
          {note}
        </p>
      </div>
      {children}
    </section>
  );
}

function Frame({
  children,
  sunken = false,
  style,
}: {
  children: React.ReactNode;
  sunken?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: sunken ? "var(--surface-1)" : "var(--surface-0)",
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "var(--text-2xs)",
        lineHeight: "var(--leading-2xs)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        color: "var(--fg-subtle)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

const ROW = {
  display: "flex",
  gap: 12,
  alignItems: "flex-end",
  flexWrap: "wrap",
} as const;

/* ------------------------------------------------------------------ page -- */

const TABS = ["Dashboard", "Jobs", "Auto Apply", "Tracker", "Inbox"];
const ALL_STATUSES = Object.keys(STATUS) as Status[];
const COLS = "minmax(0,2fr) minmax(0,1fr) 120px 72px";

export default function StyleguidePage() {
  const [tab, setTab] = React.useState("Jobs");
  const [dense, setDense] = React.useState(true);
  const [lanePaused, setLanePaused] = React.useState(false);
  const [salary, setSalary] = React.useState("USD 170,000");
  const [laneName, setLaneName] = React.useState("Strategy director, US remote");
  const [email, setEmail] = React.useState("jack.miller");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState(1);
  const [selectedMail, setSelectedMail] = React.useState(0);
  const [stamp, setStamp] = React.useState<"apply" | "skip" | null>(null);

  return (
    <div style={{ minHeight: "100%", background: "var(--surface-0)" }}>
      <TopNav
        tabs={TABS}
        active={tab}
        onSelect={setTab}
        right={
          <>
            <Rows3
              size={16}
              strokeWidth={1.5}
              color="var(--fg-subtle)"
              aria-hidden="true"
            />
            <Toggle on={dense} onChange={setDense} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
              8 of 10 applications today
            </span>
            <span
              style={{
                width: 24,
                height: 24,
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-xs)",
                fontSize: "var(--text-2xs)",
                fontWeight: 500,
              }}
            >
              JM
            </span>
          </>
        }
      />

      <main
        style={{
          maxWidth: "var(--content-max)",
          margin: "0 auto",
          padding: "var(--content-pad)",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-xl)",
              lineHeight: "var(--leading-xl)",
              letterSpacing: "var(--tracking-tight)",
              fontWeight: 500,
            }}
          >
            Styleguide
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-base)",
              color: "var(--fg-muted)",
              maxWidth: 640,
              textWrap: "pretty",
            }}
          >
            Every shared component in every state. Monochrome, no shadows, status by
            glyph and border weight. Company logos are left out here because they load
            from Logo.dev with a token.
          </p>
        </header>

        {/* ---------------------------------------------------------- colour -- */}

        <Section title="Colour" note="Warm grey ramp, black, white, one muted red.">
          <Frame>
            <Label>Ramp</Label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["white", "var(--jl-white)"],
                ["grey 50", "var(--jl-grey-50)"],
                ["grey 100", "var(--jl-grey-100)"],
                ["grey 200", "var(--jl-grey-200)"],
                ["grey 300", "var(--jl-grey-300)"],
                ["grey 400", "var(--jl-grey-400)"],
                ["grey 500", "var(--jl-grey-500)"],
                ["grey 700", "var(--jl-grey-700)"],
                ["grey 800", "var(--jl-grey-800)"],
                ["grey 900", "var(--jl-grey-900)"],
                ["red", "var(--jl-red)"],
                ["red soft", "var(--jl-red-soft)"],
              ].map(([name, value]) => (
                <div key={name} style={{ width: 84 }}>
                  <div
                    style={{
                      height: 48,
                      background: value,
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "var(--text-2xs)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {name}
                  </div>
                </div>
              ))}
            </div>
          </Frame>
        </Section>

        {/* ------------------------------------------------------------ type -- */}

        <Section
          title="Type"
          note="Geist 400, 500 and 600. 500 is the only emphasis in product UI."
        >
          <Frame>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["4xl 52/56", "var(--text-4xl)", "var(--leading-4xl)", 500],
                ["3xl 36/40", "var(--text-3xl)", "var(--leading-3xl)", 500],
                ["2xl 28/34", "var(--text-2xl)", "var(--leading-2xl)", 600],
                ["xl 22/28", "var(--text-xl)", "var(--leading-xl)", 500],
                ["lg 18/26", "var(--text-lg)", "var(--leading-lg)", 400],
                ["md 16/24", "var(--text-md)", "var(--leading-md)", 400],
                ["base 14/20", "var(--text-base)", "var(--leading-base)", 400],
                ["sm 13/20", "var(--text-sm)", "var(--leading-sm)", 400],
                ["xs 12/16", "var(--text-xs)", "var(--leading-xs)", 400],
                ["2xs 11/16", "var(--text-2xs)", "var(--leading-2xs)", 400],
              ].map(([name, size, leading, weight]) => (
                <div
                  key={name as string}
                  style={{ display: "flex", gap: 16, alignItems: "baseline" }}
                >
                  <span
                    style={{
                      width: 96,
                      flex: "none",
                      fontSize: "var(--text-2xs)",
                      color: "var(--fg-subtle)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {name}
                  </span>
                  <span
                    style={{
                      fontSize: size as string,
                      lineHeight: leading as string,
                      fontWeight: weight as number,
                      letterSpacing:
                        name === "4xl 52/56"
                          ? "-0.03em"
                          : ["3xl 36/40", "2xl 28/34", "xl 22/28"].includes(
                                name as string,
                              )
                            ? "var(--tracking-tight)"
                            : 0,
                    }}
                  >
                    Submitted. Receipt saved.
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                <span
                  style={{
                    width: 96,
                    flex: "none",
                    fontSize: "var(--text-2xs)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  wordmark
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    letterSpacing: "var(--tracking-wordmark)",
                  }}
                >
                  JOBLUVO
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                <span
                  style={{
                    width: 96,
                    flex: "none",
                    fontSize: "var(--text-2xs)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  tabular
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  USD 175k to 215k. 8 of 10 applications today. 18 Sep.
                </span>
              </div>
            </div>
          </Frame>
        </Section>

        {/* --------------------------------------------------------- buttons -- */}

        <Section
          title="Button"
          note="Primary, secondary, ghost. Sizes 28, 36 and 44. One primary per view."
        >
          <Frame>
            <Label>Variants and sizes</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(["primary", "secondary", "ghost"] as const).map((variant) => (
                <div key={variant} style={ROW}>
                  <span
                    style={{
                      width: 80,
                      fontSize: "var(--text-xs)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {variant}
                  </span>
                  <Button variant={variant} size="sm">
                    Apply
                  </Button>
                  <Button variant={variant} size="md">
                    Apply
                  </Button>
                  <Button variant={variant} size="lg">
                    Apply
                  </Button>
                  <Button variant={variant} selected>
                    Selected
                  </Button>
                  <Button variant={variant} disabled>
                    Disabled
                  </Button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Label>Segmented group, two or three options</Label>
              <div style={{ display: "flex", gap: 4 }}>
                <Button size="sm" selected>
                  Compact
                </Button>
                <Button size="sm">Regular</Button>
              </div>
            </div>
          </Frame>
        </Section>

        {/* ---------------------------------------------------------- inputs -- */}

        <Section
          title="Input, Select and Toggle"
          note="36px controls. The error border is the only red in the system."
        >
          <Frame>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              <Input
                label="Lane name"
                value={laneName}
                onChange={(e) => setLaneName(e.target.value)}
              />
              <Input label="Title contains" placeholder="Director, strategy" />
              <Input
                label="Daily cap"
                value="10"
                readOnly
                hint="Your plan allows 25 a day."
              />
              <Input
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error="Enter a work email"
              />
              <Input label="Locked field" value="Jack Miller" disabled />
              <Select
                label="Minimum salary"
                options={["USD 150,000", "USD 160,000", "USD 170,000", "USD 180,000"]}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
              <Select label="Disabled" options={["Greenhouse"]} disabled />
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                maxWidth: 420,
              }}
            >
              <Label>Toggle</Label>
              <div style={ROW}>
                <Toggle on={false} />
                <Toggle on />
                <Toggle on={false} disabled />
                <Toggle on disabled />
              </div>
              <Toggle
                on={lanePaused}
                onChange={setLanePaused}
                label="Pause on unknown questions"
                description="The application waits for you instead of guessing."
              />
              <Toggle
                on
                disabled
                label="Disabled row"
                description="Half opacity on the whole row."
              />
            </div>
          </Frame>
        </Section>

        {/* ------------------------------------------------------- statustag -- */}

        <Section
          title="StatusTag"
          note="Eleven states, read by glyph and border weight, never by colour."
        >
          <Frame>
            <Label>Medium</Label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ALL_STATUSES.map((s) => (
                <StatusTag key={s} status={s} />
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Label>Small</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ALL_STATUSES.map((s) => (
                  <StatusTag key={s} status={s} size="sm" />
                ))}
              </div>
            </div>
          </Frame>
        </Section>

        {/* ------------------------------------------------------------ card -- */}

        <Section
          title="Card and StatTile"
          note="1px border, 8px radius, header on surface-header. Cards never nest."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            <Card
              title="Top matches"
              action={
                <Button variant="ghost" size="sm">
                  All 42
                </Button>
              }
            >
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
                Padded body. Use this for prose and forms.
              </p>
            </Card>

            <Card title="Applications" padded={false}>
              <TableRow header columns="minmax(0,1fr) 120px" cells={["Company", "Status"]} />
              <TableRow
                columns="minmax(0,1fr) 120px"
                cells={["Datadog", <StatusTag key="s" status="interviewing" size="sm" />]}
              />
              <TableRow
                columns="minmax(0,1fr) 120px"
                cells={["Stripe", <StatusTag key="s" status="submitted" size="sm" />]}
              />
            </Card>

            <Card>
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
                No header. Just a bordered surface.
              </p>
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            <StatTile label="Applications" value="128" note="8 sent today" />
            <StatTile label="Replies" value="4" note="2 interviews, 1 offer" />
            <StatTile label="Response rate" value="3%" note="Up from 2% last month" />
            <StatTile label="Days active" value="22" note="Since 25 Aug" last />
          </div>
        </Section>

        {/* -------------------------------------------------------- tablerow -- */}

        <Section
          title="TableRow"
          note="Compact 32px, regular 40px. Selected fills surface-2. No zebra striping."
        >
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            <TableRow
              header
              columns={COLS}
              cells={["Role", "Company", "Status", "Match"]}
            />
            {[
              ["Director, Strategy", "Datadog", "interviewing", "88%"],
              ["Strategy and Operations Lead", "Stripe", "submitted", "71%"],
              ["Head of Business Operations", "Spotify", "needs", "64%"],
              ["Principal Program Manager", "Snowflake", "ghosted", "58%"],
              ["Senior Strategy Manager", "Uber", "rejected", "51%"],
            ].map(([role, company, status, match], i) => (
              <TableRow
                key={role}
                columns={COLS}
                density={dense ? "compact" : "regular"}
                selected={selectedRow === i}
                onClick={() => setSelectedRow(i)}
                cells={[
                  role,
                  company,
                  <StatusTag key="s" status={status as Status} size="sm" />,
                  <span key="m" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {match}
                  </span>,
                ]}
              />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--fg-subtle)" }}>
            Density follows the switch in the top nav. Click a row to select it.
          </p>
        </Section>

        {/* ------------------------------------------------- kanban and inbox -- */}

        <Section
          title="KanbanCard and InboxRow"
          note="Columns sit on surface-1. Unread is weight 500, not a dot."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            <Frame sunken>
              <Label>Tracker column</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <KanbanCard
                  company="Datadog"
                  title="Director, Strategy"
                  match={88}
                  event="Second round booked"
                  date="3 Sep"
                />
                <KanbanCard
                  company="Mistral AI"
                  title="Head of Revenue Operations"
                  match={74}
                  event="Recruiter screen done"
                  date="1 Sep"
                />
                <KanbanCard
                  company="Shopify"
                  title="Strategy Lead, Payments"
                  event="Waiting on the panel"
                  date="29 Aug"
                />
              </div>
            </Frame>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {[
                {
                  from: "Datadog",
                  subject: "Second round",
                  preview: "We would like to invite you",
                  when: "Yesterday",
                  status: "interviewing" as Status,
                  unread: true,
                },
                {
                  from: "Salesforce",
                  subject: "One question before we submit",
                  preview: "US work authorization",
                  when: "18 Sep",
                  status: "needs" as Status,
                  unread: true,
                },
                {
                  from: "Stripe",
                  subject: "Application received",
                  preview: "Thanks for applying to Stripe",
                  when: "16 Sep",
                  status: "submitted" as Status,
                },
                {
                  from: "Airbnb",
                  subject: "Update on your application",
                  preview: "We are moving ahead with other candidates",
                  when: "12 Sep",
                  status: "rejected" as Status,
                },
              ].map((m, i) => (
                <InboxRow
                  key={m.from}
                  {...m}
                  selected={selectedMail === i}
                  onClick={() => setSelectedMail(i)}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ----------------------------------------------------------- jobs -- */}

        <Section
          title="JobCard"
          note="The match number is the only large type. Always include one reason against."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            <JobCard
              company="Stripe"
              title="Strategy and Operations Lead"
              location="New York"
              salary="USD 175k to 215k"
              ats="Greenhouse"
              posted="3 days ago"
              match={71}
              reasons={[
                "Operations and strategy split like yours",
                "Payments experience from your last role",
                "- Lead title, not director",
              ]}
              onApply={() => showToast({ text: "Applying to Stripe. Resume tailored, submitting now.", actionLabel: "Undo" })}
              onSave={() => showToast({ text: "Saved to your list." })}
              onSkip={() => showToast({ text: "Skipped. You will not see this again.", actionLabel: "Undo" })}
            />
            <JobCard
              company="Datadog"
              title="Director, Strategy"
              location="New York or remote"
              salary="USD 190k to 240k"
              ats="Workday"
              posted="2 hours ago"
              match={88}
              reasons={["Director title", "- Wants SaaS pricing exposure"]}
              onApply={() => showToast({ text: "Applying to Datadog. Resume tailored, submitting now.", actionLabel: "Undo" })}
            />
            <JobCard
              company="Nvidia"
              title="Business Operations Manager"
              location="Santa Clara"
              match={49}
              reasons={["- Onsite five days a week", "- Below your salary floor"]}
            />
          </div>
        </Section>

        <Section
          title="SwipeCard"
          note="400x440 with the match ring. Stamps throw the card off screen in 200ms."
        >
          <Frame sunken style={{ padding: 32 }}>
            <div
              style={{
                position: "relative",
                width: 400,
                height: 440,
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--surface-0)",
                  transform: "scale(.92)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--surface-0)",
                  transform: "scale(.96)",
                }}
              />
              <SwipeCard
                company="Datadog"
                title="Director, Strategy"
                location="New York or remote"
                posted="2 h ago"
                salary="USD 190k to 240k"
                ats="Greenhouse"
                match={88}
                reasons={["Director title", "- Wants SaaS pricing exposure"]}
                footnote="Resume Strategy_v3 will be tailored for this role."
                stamp={stamp}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
              <Button size="sm" onClick={() => setStamp("skip")}>
                Skip
              </Button>
              <Button variant="primary" size="sm" onClick={() => setStamp("apply")}>
                Apply
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStamp(null)}>
                Reset
              </Button>
            </div>
          </Frame>
        </Section>

        {/* -------------------------------------------------------- feedback -- */}

        <Section
          title="Banner"
          note="One line, one job. Attention is a black border, info a grey one."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Banner
              title="Salesforce needs an answer from you."
              body="The form asks about US work authorization."
              primary={
                <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                  Answer
                </Button>
              }
              secondary={<Button size="sm">Later</Button>}
            />
            <Banner
              tone="info"
              title="Auto apply is paused."
              body="You reached the daily cap of 10 applications."
              primary={<Button size="sm">Raise cap</Button>}
            />
          </div>
        </Section>

        <Section
          title="Modal and Toast"
          note="Modal is Radix Dialog underneath. Toast is sonner, never stacked."
        >
          <Frame>
            <div style={ROW}>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
              <Button
                onClick={() =>
                  showToast({
                    text: "Applying to Datadog. Resume tailored, submitting now.",
                    actionLabel: "Undo",
                    onAction: () => showToast({ text: "Stopped. Nothing was sent." }),
                  })
                }
              >
                Show toast with undo
              </Button>
              <Button onClick={() => showToast({ text: "Submitted. Receipt saved." })}>
                Show plain toast
              </Button>
            </div>
            <div style={{ marginTop: 20 }}>
              <Label>Toast pill, shown in place</Label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ToastPill text="Submitted. Receipt saved." />
                <ToastPill
                  text="Applying to Datadog. Resume tailored, submitting now."
                  actionLabel="Undo"
                />
              </div>
            </div>
          </Frame>

          <Modal
            open={modalOpen}
            title="Pause Strategy director, US remote?"
            confirmLabel="Pause lane"
            onCancel={() => setModalOpen(false)}
            onConfirm={() => {
              setModalOpen(false);
              showToast({ text: "Lane paused. Nothing new will be sent." });
            }}
          >
            Applications already in progress will finish.
          </Modal>
        </Section>

        {/* ----------------------------------------------------------- agent -- */}

        <Section
          title="ChatBubble"
          note="Maya and Daniel are outlined on the left, you are filled on the right."
        >
          <Frame
            sunken
            style={{
              maxWidth: "var(--panel-width)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <ChatBubble from="user">
              Director roles in strategy, New York or remote.
            </ChatBubble>
            <ChatBubble from="agent">
              Done. That rules out 11 of the 42 matches today. Want me to apply to the
              top three now?
            </ChatBubble>
            <ChatBubble from="user">Only the ones above 80 percent.</ChatBubble>
            <ChatBubble from="agent">
              Two qualify, Datadog at 88 and Snowflake at 84. Shall I start with
              Datadog?
            </ChatBubble>
          </Frame>
        </Section>

        <footer
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
            fontSize: "var(--text-xs)",
            color: "var(--fg-subtle)",
          }}
        >
          Tokens and components come from the jobluvo-design handoff in
          .claude/skills/jobluvo-design.
        </footer>
      </main>
    </div>
  );
}
