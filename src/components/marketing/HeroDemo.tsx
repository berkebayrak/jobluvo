"use client";

import * as React from "react";
import { demoJobs, feedLines, companyDomains, type DemoJob } from "@/lib/marketing/content";
import { logoUrl } from "@/lib/logo";

/**
 * The animated product demo beside the hero. A three deep card deck that swipes
 * itself, with the activity ticker underneath.
 *
 * Motion follows the design system: 200ms for movement, nothing bounces.
 */
function Card({ job, state }: { job: DemoJob; state: string }) {
  return (
    <div className={`dcard ${state}`}>
      <div className="top">
        <div className="co">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs, no loader configured */}
          <img src={logoUrl(companyDomains[job.co] ?? "example.com")} alt="" />
          {job.co}
        </div>
        <div className="ring" style={{ ["--p" as string]: job.p }}>
          <b>{job.p}%</b>
          <small>MATCH</small>
        </div>
      </div>
      <h4>{job.t}</h4>
      <div className="meta">{job.loc}</div>
      <div className="facts">
        <div>
          Salary<b>{job.s}</b>
        </div>
        <div>
          Level<b>{job.l}</b>
        </div>
      </div>
      <div className="why">
        {job.w.map((x) => (
          <span key={x} className={job.act === "skip" ? "neg" : undefined}>
            {x}
          </span>
        ))}
      </div>
      <div className={`stamp apply${state === "out-r" ? " show" : ""}`}>APPLY</div>
      <div className={`stamp skip${state === "out-l" ? " show" : ""}`}>SKIP</div>
    </div>
  );
}

export function HeroDemo({ withFeed = true }: { withFeed?: boolean }) {
  const [i, setI] = React.useState(0);
  const [leaving, setLeaving] = React.useState(false);
  const [feed, setFeed] = React.useState<number[]>([0]);

  React.useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), 2600);
    const next = setTimeout(() => {
      setLeaving(false);
      setI((n) => (n + 1) % demoJobs.length);
    }, 3200);
    return () => {
      clearTimeout(leave);
      clearTimeout(next);
    };
  }, [i]);

  React.useEffect(() => {
    if (!withFeed) return;
    const t = setInterval(() => {
      setFeed((f) => [...f, (f[f.length - 1] + 1) % feedLines.length].slice(-4));
    }, 2200);
    return () => clearInterval(t);
  }, [withFeed]);

  const top = demoJobs[i];
  const second = demoJobs[(i + 1) % demoJobs.length];
  const third = demoJobs[(i + 2) % demoJobs.length];
  const out = top.act === "apply" ? "out-r" : "out-l";

  return (
    <div className="demo">
      <div className="deck">
        <Card key={`p2-${i}`} job={third} state="p2" />
        <Card key={`p1-${i}`} job={second} state="p1" />
        <Card key={`top-${i}`} job={top} state={leaving ? out : ""} />
      </div>
      <div className="dbtns">
        <span className={leaving && top.act === "skip" ? "hit" : undefined}>Skip</span>
        <span>Save</span>
        <span className={leaving && top.act === "apply" ? "hit" : undefined}>Apply</span>
      </div>
      {withFeed && (
        <div className="feed">
          {feed.map((n, k) => (
            <div className="fitem" key={`${n}-${k}`}>
              <i className={feedLines[n].strong ? "strong" : undefined} />
              {feedLines[n].text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
