"use client";

import * as React from "react";
import { Button } from "@/components/core/Button";
import { KanbanCard } from "@/components/data/KanbanCard";
import { StatusTag } from "@/components/data/StatusTag";
import { TableRow } from "@/components/data/TableRow";
import { showToast } from "@/components/feedback/Toaster";
import { domains, pipeline, stageMap, stages } from "@/lib/app/data";
import { logoUrl } from "@/lib/logo";

const COLS = "minmax(0,2.4fr) minmax(0,1.2fr) 130px minmax(0,1.2fr) 110px";

export default function TrackerPage() {
  const [mode, setMode] = React.useState<"board" | "list">("board");
  const [query, setQuery] = React.useState("");
  const [hideGhosted, setHideGhosted] = React.useState(false);

  const rows = pipeline.filter(
    (p) =>
      (!hideGhosted || p.stage !== "Ghosted") &&
      (!query || (p.co + p.t).toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tracker</h1>
          <p className="sub">
            Where each application stands with the employer. Execution status lives on the
            dashboard; this board is about hiring stages.
          </p>
        </div>
        <div className="row">
          <div className="seg">
            <button
              className={mode === "board" ? "on" : undefined}
              onClick={() => setMode("board")}
            >
              Board
            </button>
            <button
              className={mode === "list" ? "on" : undefined}
              onClick={() => setMode("list")}
            >
              List
            </button>
          </div>
          <Button size="sm" onClick={() => showToast({ text: "Import CSV. This is a mock." })}>
            Import CSV
          </Button>
          <Button size="sm" onClick={() => showToast({ text: "Export CSV. This is a mock." })}>
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => showToast({ text: "Add application. This is a mock." })}
          >
            Add application
          </Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <input
            placeholder="Search company or role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="chip">Lane</button>
        <button className="chip">Resume</button>
        <button className="chip">Applied date</button>
        <button
          className={`chip${hideGhosted ? " on" : ""}`}
          onClick={() => setHideGhosted(!hideGhosted)}
        >
          Hide ghosted
        </button>
      </div>

      {mode === "board" ? (
        <div className="kanban">
          {stages.map((stage) => {
            const items = rows.filter((p) => p.stage === stage);
            return (
              <div className="kcol" key={stage}>
                <div className="kcol-head">
                  {stage}
                  <span>{items.length}</span>
                </div>
                {items.map((p) => (
                  <KanbanCard
                    key={p.id}
                    company={p.co}
                    logo={logoUrl(domains[p.co] ?? "example.com")}
                    title={p.t}
                    event={p.note}
                    date={p.tag ?? `${p.days}d`}
                  />
                ))}
                {items.length === 0 && (
                  <span className="sub" style={{ fontSize: "var(--text-xs)" }}>
                    Nothing here.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
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
            cells={["Role", "Company", "Stage", "Lane", "Last event"]}
          />
          {rows.map((p) => (
            <TableRow
              key={p.id}
              columns={COLS}
              onClick={() => showToast({ text: `${p.co}. ${p.t}.` })}
              cells={[
                p.t,
                p.co,
                <StatusTag key="s" status={stageMap[p.stage] ?? "applied"} size="sm" />,
                p.lane,
                <span key="n" style={{ color: "var(--fg-subtle)" }}>
                  {p.note}
                </span>,
              ]}
            />
          ))}
        </div>
      )}
    </>
  );
}
