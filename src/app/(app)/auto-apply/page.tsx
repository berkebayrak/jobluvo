"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/core/Button";
import { Card } from "@/components/data/Card";
import { Input } from "@/components/core/Input";
import { Modal } from "@/components/feedback/Modal";
import { Select } from "@/components/core/Select";
import { Toggle } from "@/components/core/Toggle";
import { showToast } from "@/components/feedback/Toaster";
import { lanes as seedLanes } from "@/lib/app/data";

const RUNS = [
  { t: "14:10", lane: "Strategy and planning", tag: "4 sent", note: "1 needs you" },
  { t: "13:40", lane: "Product management", tag: "2 held", note: "for review" },
  { t: "09:05", lane: "Strategy and planning", tag: "3 sent", note: "" },
  { t: "Yesterday", lane: "Both lanes", tag: "11 sent", note: "1 failed" },
];

export default function AutoApplyPage() {
  const router = useRouter();
  const [lanes, setLanes] = React.useState(seedLanes);
  const [curId, setCurId] = React.useState(seedLanes[0].id);
  const [autoApply, setAutoApply] = React.useState(true);
  const [cap, setCap] = React.useState("15");
  const [pauseOpen, setPauseOpen] = React.useState(false);

  const lane = lanes.find((l) => l.id === curId) ?? lanes[0];
  const capUsed = 9;
  const activeCount = lanes.filter((l) => l.status === "Running").length;

  function update(patch: Partial<typeof lane>) {
    setLanes((ls) => ls.map((l) => (l.id === lane.id ? { ...l, ...patch } : l)));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Auto Apply</h1>
          <p className="sub">
            Set each lane once. Jobluvo checks new matches several times a day and applies
            within your rules. Sample data until lanes run.
          </p>
        </div>
        <div className="row">
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Auto Apply</span>
          <Toggle on={autoApply} onChange={setAutoApply} />
        </div>
      </div>

      <div className="aa-layout">
        <div>
          <Card
            title={`Lanes, ${activeCount} of 5 active`}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => showToast({ text: "New lane. This is a mock." })}
              >
                Add lane
              </Button>
            }
            padded={false}
          >
            {lanes.map((l) => (
              <div
                key={l.id}
                className={`lane-row${l.id === curId ? " on" : ""}`}
                onClick={() => setCurId(l.id)}
              >
                <div className="name">
                  {l.name}
                  <span className={`tag${l.status === "Running" ? " strong" : " quiet"}`}>
                    {l.status}
                  </span>
                </div>
                <div className="desc">
                  {l.resume}. {l.quality} matches.
                </div>
                <div className="kv">
                  <span>
                    Today <b>{l.today}</b>
                  </span>
                  <span>
                    Review <b>{l.review ? "On" : "Off"}</b>
                  </span>
                </div>
              </div>
            ))}
            <p className="sub" style={{ padding: "10px 16px", margin: 0 }}>
              A lane changes what gets considered, not how much gets sent. All lanes draw
              from one daily cap, best matches first.
            </p>
          </Card>

          <div style={{ marginTop: 12 }}>
            <Card title="Shared daily cap">
              <div className="row">
                <Input
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  style={{ width: 90 }}
                />
                <span className="sub">per day, 1 to 150</span>
              </div>
              <div className="progress">
                <i style={{ width: `${(capUsed / Number(cap || 15)) * 100}%` }} />
              </div>
              <div className="sub" style={{ marginTop: 6 }}>
                {capUsed} of {cap} used today. Resets at midnight in your time zone.
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 12 }}>
            <Card title="Run history">
              {RUNS.map((r) => (
                <div className="run" key={`${r.t}-${r.lane}`}>
                  <span className="sub" style={{ width: 70, flex: "none" }}>
                    {r.t}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{r.lane}</span>
                  <span style={{ fontWeight: 500 }}>{r.tag}</span>
                  <span className="sub">{r.note}</span>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                style={{ marginTop: 6 }}
                onClick={() => router.push("/tracker")}
              >
                View all in tracker
              </Button>
            </Card>
          </div>
        </div>

        <Card
          title={lane.name}
          action={
            <div className="row">
              <Button size="sm" onClick={() => setPauseOpen(true)}>
                {lane.status === "Running" ? "Pause lane" : "Resume lane"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => showToast({ text: "Delete lane. This is a mock." })}
              >
                Delete
              </Button>
            </div>
          }
        >
          <span className="sub">Lane settings. Changes apply from the next run.</span>

          <div className="form-block">
            <h4>Targeting</h4>
            <div className="frow">
              <div className="l">
                <b>Resume profile</b>
                <span>
                  The base resume this lane tailors from. Tailoring only reorders and
                  rephrases verified facts.
                </span>
              </div>
              <div className="r">
                <Select
                  options={["Strategy v3", "PM v2", "Original upload"]}
                  value={lane.resume}
                  onChange={(e) => update({ resume: e.target.value })}
                />
              </div>
            </div>
            <div className="frow">
              <div className="l">
                <b>Job filters</b>
                <span>{lane.filters.length} active</span>
              </div>
              <div className="r">
                <Button size="sm" onClick={() => showToast({ text: "Edit filters. Mock." })}>
                  Edit filters
                </Button>
              </div>
            </div>
            <div className="frow">
              <div className="l" style={{ flex: 1 }}>
                <b>Standing instructions</b>
                <span>
                  Anything the filters cannot say, in your own words. Checked against each
                  job before applying. This can only rule jobs out, never add new ones.
                </span>
                <textarea
                  className="textarea"
                  style={{ marginTop: 8 }}
                  value={lane.instr}
                  onChange={(e) => update({ instr: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="form-block">
            <h4>Quality and review</h4>
            <div className="frow">
              <div className="l">
                <b>Minimum match quality</b>
                <span>
                  Only apply to jobs at least this strong for this resume. A higher bar
                  means fewer, sharper applications.
                </span>
              </div>
              <div className="r">
                <div className="pill-group">
                  {["Strong", "Good", "Stretch"].map((q) => (
                    <button
                      key={q}
                      className={lane.quality === q ? "on" : undefined}
                      onClick={() => update({ quality: q })}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="frow">
              <div className="l">
                <b>Review before submit</b>
                <span>
                  Fill each application, then hold it for you to check and send. Nothing
                  goes out until you approve. Works on sites that support pausing;
                  elsewhere this lane submits as usual and tells you which sites those are.
                </span>
              </div>
              <div className="r">
                <Toggle on={lane.review} onChange={(v) => update({ review: v })} />
              </div>
            </div>
            <div className="frow">
              <div className="l">
                <b>Unknown answers</b>
                <span>
                  When a form asks something your profile cannot answer, the application
                  waits for you. Answers are never guessed.
                </span>
              </div>
              <div className="r">
                <span className="tag strong">Always on</span>
              </div>
            </div>
          </div>

          <div className="form-block">
            <h4>Filters on this lane</h4>
            <div className="taglist">
              {lane.filters.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={pauseOpen}
        title={`${lane.status === "Running" ? "Pause" : "Resume"} ${lane.name}?`}
        confirmLabel={lane.status === "Running" ? "Pause lane" : "Resume lane"}
        onCancel={() => setPauseOpen(false)}
        onConfirm={() => {
          const next = lane.status === "Running" ? "Paused" : "Running";
          update({ status: next });
          setPauseOpen(false);
          showToast({
            text:
              next === "Paused"
                ? "Lane paused. Nothing new will be sent."
                : "Lane running again.",
          });
        }}
      >
        Applications already in progress will finish.
      </Modal>
    </>
  );
}
