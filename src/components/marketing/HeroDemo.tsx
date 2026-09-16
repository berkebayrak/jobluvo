"use client";

import * as React from "react";
import { demoJobs, feedLines, companyDomains, type DemoJob } from "@/lib/marketing/content";
import { logoUrl } from "@/lib/logo";

/**
 * The animated product demo beside the hero.
 *
 * Mechanics and timings are the delivered site's: a three deep deck where the
 * cards keep their identity, so promoting one from the back animates through
 * the 0.6s transform transition rather than snapping. A cycle runs every
 * 2600ms, first at 900ms; the stamp and the button press land at the start,
 * the card leaves at +450ms, and the deck advances at +1050ms with a new card
 * easing in at the back.
 */

type Slot = { id: number; job: DemoJob };

const CYCLE = 2600;
const FIRST = 900;
const LEAVE_AT = 450;
const ADVANCE_AT = 1050;
const FEED_EVERY = 3400;

/** Back to front: the last entry is the card on top. */
function initialDeck(): Slot[] {
  return [2, 1, 0].map((k) => ({ id: k, job: demoJobs[k % demoJobs.length] }));
}

function Card({
  job,
  className,
  stamp,
}: {
  job: DemoJob;
  className: string;
  stamp: "apply" | "skip" | null;
}) {
  return (
    <div className={className}>
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
      <div className={`stamp apply${stamp === "apply" ? " show" : ""}`}>APPLY</div>
      <div className={`stamp skip${stamp === "skip" ? " show" : ""}`}>SKIP</div>
    </div>
  );
}

export function HeroDemo({ withFeed = true }: { withFeed?: boolean }) {
  const [deck, setDeck] = React.useState<Slot[]>(initialDeck);
  const [stamp, setStamp] = React.useState<"apply" | "skip" | null>(null);
  const [hit, setHit] = React.useState<"apply" | "skip" | null>(null);
  const [leaving, setLeaving] = React.useState(false);
  const [entering, setEntering] = React.useState<number | null>(null);
  // Seeded here, not in an effect: an effect body runs twice under StrictMode
  // and would seed the rows, and their keys, twice over.
  const [feed, setFeed] = React.useState<{ key: number; line: number }[]>(() => [
    { key: 1, line: 1 },
    { key: 0, line: 0 },
  ]);
  const feedCount = React.useRef(2);

  const deckRef = React.useRef<Slot[]>(deck);
  const topIndex = React.useRef(0);
  const nextId = React.useRef(3);

  React.useEffect(() => {
    const timeouts: number[] = [];

    function step() {
      const cur = deckRef.current;
      const act = cur[cur.length - 1].job.act;
      setStamp(act);
      setHit(act);

      timeouts.push(
        window.setTimeout(() => {
          setLeaving(true);
          setHit(null);
        }, LEAVE_AT),
      );

      timeouts.push(
        window.setTimeout(() => {
          const id = nextId.current++;
          topIndex.current = (topIndex.current + 1) % demoJobs.length;
          const incoming = demoJobs[(topIndex.current + 2) % demoJobs.length];
          // Drop the card that left, promote the rest, add one at the back.
          const next = [{ id, job: incoming }, ...deckRef.current.slice(0, -1)];
          deckRef.current = next;
          setDeck(next);
          setEntering(id);
          setLeaving(false);
          setStamp(null);
        }, ADVANCE_AT),
      );
    }

    const first = window.setTimeout(step, FIRST);
    const cycle = window.setInterval(step, CYCLE);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(cycle);
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Two frames on the back card's entering state, so the browser paints it
  // small and transparent before transitioning it into place. The timeout is a
  // floor: a background tab stops serving frames, and without it the card would
  // stay invisible until the tab was looked at again.
  React.useEffect(() => {
    if (entering === null) return;
    const clear = () => setEntering(null);
    const outer = requestAnimationFrame(() => requestAnimationFrame(clear));
    const floor = window.setTimeout(clear, 120);
    return () => {
      cancelAnimationFrame(outer);
      window.clearTimeout(floor);
    };
  }, [entering]);

  // Newest first, three deep, with the delivered relative times.
  React.useEffect(() => {
    if (!withFeed) return;
    const iv = window.setInterval(() => {
      const key = feedCount.current++;
      setFeed((f) => [{ key, line: key % feedLines.length }, ...f].slice(0, 3));
    }, FEED_EVERY);
    return () => window.clearInterval(iv);
  }, [withFeed]);

  return (
    <div className="demo">
      <div className="deck">
        {deck.map((slot, k) => {
          const pos = deck.length - 1 - k; // 0 is the top card
          const isTop = pos === 0;
          const out = leaving && isTop ? (stamp === "apply" ? " out-r" : " out-l") : "";
          const cls =
            "dcard" +
            (pos ? ` p${pos}` : "") +
            (entering === slot.id ? " enter" : "") +
            out;
          return (
            <Card
              key={slot.id}
              job={slot.job}
              className={cls}
              stamp={isTop ? stamp : null}
            />
          );
        })}
      </div>

      <div className="dbtns">
        <span className={hit === "skip" ? "hit" : undefined}>Skip</span>
        <span>Save</span>
        <span className={hit === "apply" ? "hit" : undefined}>Apply</span>
      </div>

      {withFeed && (
        <div className="feed">
          {feed.map((f, k) => (
            <div className="fitem" key={f.key}>
              <i className={feedLines[f.line].strong ? "strong" : undefined} />
              {feedLines[f.line].text}
              <span className="t">{k === 0 ? "just now" : `${k * 2} min ago`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
