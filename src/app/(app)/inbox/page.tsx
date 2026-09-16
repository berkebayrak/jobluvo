"use client";

import * as React from "react";
import { Button } from "@/components/core/Button";
import { InboxRow } from "@/components/data/InboxRow";
import { StatusTag } from "@/components/data/StatusTag";
import { showToast } from "@/components/feedback/Toaster";
import { domains, mails, stageMap, type Mail } from "@/lib/app/data";
import { logoUrl } from "@/lib/logo";

type FolderDef = { label: string; test: (m: Mail) => boolean } | null;

const FOLDERS: FolderDef[] = [
  { label: "All", test: (m) => m.folder === "inbox" },
  { label: "Unread", test: (m) => m.folder === "inbox" && m.unread },
  { label: "Needs reply", test: (m) => m.folder === "inbox" && m.needs },
  null,
  { label: "Interview", test: (m) => m.folder === "inbox" && m.label === "Interview" },
  { label: "Assessment", test: (m) => m.folder === "inbox" && m.label === "Assessment" },
  { label: "Recruiter", test: (m) => m.folder === "inbox" && m.label === "Recruiter" },
  { label: "Confirmation", test: (m) => m.folder === "inbox" && m.label === "Confirmation" },
  {
    label: "Verification",
    test: (m) => m.folder === "inbox" && m.label.startsWith("Verification"),
  },
  { label: "Rejection", test: (m) => m.folder === "inbox" && m.label === "Rejection" },
  null,
  { label: "Unlinked", test: (m) => m.folder === "inbox" && !m.linked },
  { label: "Sent", test: (m) => m.folder === "sent" },
  { label: "Archive", test: (m) => m.folder === "archive" },
];

export default function InboxPage() {
  const [folder, setFolder] = React.useState("All");
  const [cur, setCur] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [addrOpen, setAddrOpen] = React.useState(false);

  const def = FOLDERS.find((f) => f && f.label === folder);
  const list = mails.filter(
    (m) =>
      (def ? def.test(m) : true) &&
      (!query || (m.from + m.subj).toLowerCase().includes(query.toLowerCase())),
  );
  const mail = list[cur] ?? list[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p className="sub">
            Everything employers send to your Jobluvo address, sorted and linked to the
            right application.
          </p>
        </div>
        <div className="row">
          <span style={{ position: "relative" }}>
            <Button onClick={() => setAddrOpen(!addrOpen)}>jack.miller@jobluvo.com</Button>
            {addrOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 42,
                  zIndex: 40,
                  width: 380,
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-md)",
                  padding: 16,
                  fontSize: "var(--text-sm)",
                }}
              >
                <div className="kvrow">
                  <span className="k">Your Jobluvo address</span>
                  <span className="v">jack.miller@jobluvo.com</span>
                </div>
                <div className="kvrow">
                  <span className="k">Forwards a copy to</span>
                  <span className="v">jack.miller@gmail.com</span>
                </div>
                <ul
                  style={{
                    margin: "12px 0 0",
                    paddingLeft: 18,
                    color: "var(--fg-muted)",
                    fontSize: "var(--text-xs)",
                    lineHeight: "18px",
                  }}
                >
                  <li>
                    Jobluvo created this address for you at sign up so your personal inbox
                    stays clean. Employer accounts and applications use it unless you choose
                    otherwise.
                  </li>
                  <li>
                    Verification codes sent here are matched to the application that asked
                    for them and filled in automatically. Nothing else in a message is
                    treated as an instruction.
                  </li>
                  <li>
                    Messages sent to your own Gmail stay there and are not shown here unless
                    you connect it.
                  </li>
                  <li>
                    The address stays yours. It is never handed to another person, even if
                    you cancel.
                  </li>
                </ul>
              </div>
            )}
          </span>
          <Button variant="primary" onClick={() => showToast({ text: "Compose. This is a mock." })}>
            Compose
          </Button>
        </div>
      </div>

      <div className="inbox">
        <div className="folders">
          {FOLDERS.map((f, i) =>
            f ? (
              <button
                key={f.label}
                className={f.label === folder ? "on" : undefined}
                onClick={() => {
                  setFolder(f.label);
                  setCur(0);
                }}
              >
                {f.label}
                <b>{mails.filter(f.test).length}</b>
              </button>
            ) : (
              <div className="sep" key={`sep-${i}`} />
            ),
          )}
        </div>

        <div className="mail-list">
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
            <div className="search" style={{ minWidth: 0, width: "100%" }}>
              <input
                placeholder="Search mail"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          {list.map((m, i) => (
            <InboxRow
              key={`${m.from}-${m.subj}`}
              from={m.from}
              logo={logoUrl(domains[m.from] ?? "example.com")}
              subject={m.subj}
              preview={m.pre}
              when={m.time}
              status={m.stage ? stageMap[m.stage] : undefined}
              unread={m.unread}
              selected={i === cur}
              onClick={() => setCur(i)}
            />
          ))}
          {list.length === 0 && (
            <p className="sub" style={{ padding: 16 }}>
              Nothing in this folder.
            </p>
          )}
        </div>

        <div className="reader">
          {mail ? (
            <>
              <div
                className="row"
                style={{ justifyContent: "space-between", marginBottom: 10 }}
              >
                <span className="tag">{mail.label}</span>
                <div className="row">
                  {mail.cal && (
                    <Button
                      size="sm"
                      onClick={() =>
                        showToast({
                          text: "Added to your calendar with the video link.",
                          actionLabel: "Undo",
                        })
                      }
                    >
                      Add to calendar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => showToast({ text: "Marked unread." })}
                  >
                    Mark unread
                  </Button>
                </div>
              </div>

              <h2>{mail.subj}</h2>
              <div className="rmeta">
                {mail.from} &lt;{mail.addr}&gt; . to jack.miller@jobluvo.com, {mail.time}
              </div>

              {mail.linked && (
                <div className="linked">
                  {mail.stage && <StatusTag status={stageMap[mail.stage]} size="sm" />}
                  <span style={{ flex: 1, minWidth: 0 }}>{mail.linked}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => showToast({ text: "Opening the application." })}
                  >
                    Open
                  </Button>
                </div>
              )}

              <div className="rbody">
                {mail.body.map((p, i) => (
                  // Body copy is from the handoff, not user input.
                  <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
                ))}
              </div>

              {mail.prep && (
                <div className="prep">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <b>Prep from Daniel</b>
                    <Button
                      size="sm"
                      onClick={() => showToast({ text: "Opening the prep plan." })}
                    >
                      Open prep plan
                    </Button>
                  </div>
                  <p>
                    A 25 minute plan: one case walkthrough on roadmap prioritisation,
                    three stories from your cost program mapped to their questions, and
                    two questions to ask the panel.
                  </p>
                </div>
              )}

              <div className="row" style={{ marginTop: 20 }}>
                <Button
                  variant="primary"
                  onClick={() => showToast({ text: "Reply. This is a mock." })}
                >
                  Reply
                </Button>
                <Button
                  onClick={() => showToast({ text: "Draft a reply with Daniel. Mock." })}
                >
                  Draft a reply with Daniel
                </Button>
                <Button onClick={() => showToast({ text: "Archived.", actionLabel: "Undo" })}>
                  Archive
                </Button>
              </div>
            </>
          ) : (
            <p className="sub">Pick a message.</p>
          )}
        </div>
      </div>
    </>
  );
}
