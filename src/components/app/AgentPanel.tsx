"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/core/Button";
import { ChatBubble } from "@/components/agent/ChatBubble";
import { showToast } from "@/components/feedback/Toaster";
import { chats } from "@/lib/app/data";

const AGENTS = [
  {
    key: "search",
    initial: "M",
    name: "Maya",
    role: "Job search agent",
    blurb: "Helps you find your ideal job.",
  },
  {
    key: "coach",
    initial: "D",
    name: "Daniel",
    role: "Career coach",
    blurb: "Helps you grow into your next role.",
  },
];

/**
 * The agent panel. 320px on the left, 48px collapsed, per the layout rules.
 * No avatars for people, so the agents are initials in a bordered tile.
 */
export function AgentPanel() {
  const [open, setOpen] = React.useState(true);
  const [agent, setAgent] = React.useState("search");
  const [chatIndex, setChatIndex] = React.useState(0);
  const [draft, setDraft] = React.useState("");

  const list = chats[agent] ?? [];
  const chat = list[chatIndex] ?? list[0];
  const active = AGENTS.find((a) => a.key === agent)!;

  function pickAgent(key: string) {
    setAgent(key);
    setChatIndex(0);
  }

  function send(text: string) {
    if (!text.trim()) return;
    setDraft("");
    showToast({ text: `Sent to ${active.name}. This is a mock, nothing is generated.` });
  }

  if (!open) {
    return (
      <aside className="side collapsed">
        <div className="side-head" style={{ padding: 0, justifyContent: "center" }}>
          <button
            className="iconbtn"
            onClick={() => setOpen(true)}
            aria-label="Open the agent panel"
          >
            <PanelLeft size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="rail">
          {AGENTS.map((a) => (
            <span
              key={a.key}
              className={`avatar${a.key === agent ? " on" : ""}`}
              title={`${a.name}, ${a.role}`}
            >
              {a.initial}
            </span>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="side">
      <div className="side-head">
        <Button size="sm" onClick={() => setChatIndex(0)}>
          New
        </Button>
        <span className="t">Agents</span>
        <button
          className="iconbtn"
          onClick={() => setOpen(false)}
          aria-label="Close the agent panel"
        >
          <PanelLeft size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="agent-list">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            className={`agent-row${a.key === agent ? " on" : ""}`}
            onClick={() => pickAgent(a.key)}
          >
            <span className="avatar">{a.initial}</span>
            <div>
              <b>
                {a.name} <em>|</em> {a.role}
              </b>
              <span>{a.blurb}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="chat-list">
        {list.map((c, i) => (
          <button
            key={c.n}
            className={`chat-row${i === chatIndex ? " on" : ""}`}
            onClick={() => setChatIndex(i)}
          >
            <span>{c.n}</span>
            <small>{c.t}</small>
          </button>
        ))}
      </div>

      <div className="side-body">
        {chat?.m.map(([who, text, actions], i) => (
          <React.Fragment key={i}>
            <ChatBubble from={who === "u" ? "user" : "agent"}>{text}</ChatBubble>
            {actions && (
              <div className="row" style={{ gap: 6 }}>
                {actions.map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    onClick={() => showToast({ text: `${a}. This is a mock.` })}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
        {chat?.q?.length ? (
          <div className="sugg">
            {chat.q.map((q) => (
              <button key={q} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="composer">
        <input
          placeholder={`Message ${active.name}...`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(draft)}
        />
        <Button size="sm" variant="primary" onClick={() => send(draft)}>
          Send
        </Button>
      </div>
    </aside>
  );
}
