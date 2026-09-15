import type { Metadata } from "next";
import { Band } from "@/components/marketing/Band";
import { aroundIt, willNotDo } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "How it works. Jobluvo",
  description:
    "Jobluvo finds the roles, prepares an honest application, submits it and follows the reply.",
};

export default function HowItWorksPage() {
  return (
    <main>
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="wrap" style={{ display: "block" }}>
          <div style={{ maxWidth: 820 }}>
            <div className="eyebrow">How it works</div>
            <h1 className="display" style={{ fontSize: "var(--text-4xl)", lineHeight: "var(--leading-4xl)" }}>
              Four stages. One engine. You stay in control.
            </h1>
            <p className="lead" style={{ maxWidth: "none" }}>
              Jobluvo finds the roles, prepares an honest application, submits it and follows
              the reply. Here is each stage with what you actually see.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- 01 find -- */}
      <section className="m-section tight">
        <div className="wrap stage">
          <div>
            <div className="sn">01</div>
            <h2 className="display">Find</h2>
            <p className="st">Be the first qualified applicant, every time.</p>
            <p>
              Career pages on 19 application systems are checked every few minutes. Copies of
              the same role are folded into one, hard filters run first, and what is left gets
              a match score with the reasons spelled out.
            </p>
          </div>
          <div className="mock">
            <div className="mock-h">
              <span>Scanning</span>
              <span className="m-tag ok">Live</span>
            </div>
            <div className="scan">
              <div>
                greenhouse.io/stripe <b>2 new</b>
              </div>
              <div>
                salesforce.wd1.myworkdayjobs.com <b>1 new</b>
              </div>
              <div>
                jobs.lever.co/spotify <b>no change</b>
              </div>
              <div>
                jobs.ashbyhq.com/mistral <b>1 new</b>
              </div>
            </div>
            <div className="alert">
              <b>New match, 74%</b>
              <span>
                Director, Corporate Strategy at Salesforce. Posted 6 minutes ago. Sponsorship
                offered.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- 02 prep -- */}
      <section className="m-section tight sunken">
        <div className="wrap stage rev">
          <div>
            <div className="sn">02</div>
            <h2 className="display">Prep</h2>
            <p className="st">A resume for this job, built only from what is true.</p>
            <p>
              The resume is reordered and rephrased to lead with what the posting asks for. You
              see every change. Titles, dates, employers, numbers and skills are never added.
              Cover letters and screening answers come from the same confirmed facts.
            </p>
          </div>
          <div className="mock">
            <div className="mock-h">
              <span>Strategy v3 for Salesforce</span>
              <span className="m-tag">4 changes, 0 new facts</span>
            </div>
            <div className="diff">
              <div className="del">
                Managed strategic projects and PMO activities across the group.
              </div>
              <div className="add">
                Led a 3 year cost program across 4 business units, reporting to the COO.
              </div>
            </div>
            <div className="diff">
              <div className="del">Responsible for planning.</div>
              <div className="add">
                Built the annual planning cadence from scratch; now used by 5 business lines.
              </div>
            </div>
            <div className="mock-f">
              <span className="m-tag ok">Every claim traces to a fact you confirmed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- 03 apply -- */}
      <section className="m-section tight">
        <div className="wrap stage">
          <div>
            <div className="sn">03</div>
            <h2 className="display">Apply</h2>
            <p className="st">Submitted for you, with proof.</p>
            <p>
              Jobluvo opens the employer&apos;s application page, creates an account if the
              portal needs one, fills every step and submits. The confirmation page and email
              are kept as a receipt. A question your profile cannot answer stops the
              application and waits for you.
            </p>
          </div>
          <div className="mock">
            <div className="mock-h">
              <span>Receipt</span>
              <span className="m-tag ok">Submitted</span>
            </div>
            <div className="kv">
              <span>Employer</span>
              <b>Salesforce, via Workday</b>
            </div>
            <div className="kv">
              <span>Role</span>
              <b>Director, Corporate Strategy</b>
            </div>
            <div className="kv">
              <span>Submitted</span>
              <b>Today 14:12</b>
            </div>
            <div className="kv">
              <span>Resume</span>
              <b>Strategy v3, tailored</b>
            </div>
            <div className="kv">
              <span>Evidence</span>
              <b>Confirmation page and email</b>
            </div>
            <div className="alert warn">
              <b>Held: export control status</b>
              <span>
                Your profile has no answer for this. Nothing was guessed. Answer once and it
                resumes.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- 04 track -- */}
      <section className="m-section tight sunken">
        <div className="wrap stage rev">
          <div>
            <div className="sn">04</div>
            <h2 className="display">Track</h2>
            <p className="st">Every reply, sorted and linked.</p>
            <p>
              Employer mail lands in your Jobluvo address, gets labelled and linked to the
              right application, and moves it along the pipeline. Interview invite? Daniel has
              a prep plan ready before you open it.
            </p>
          </div>
          <div className="mock">
            <div className="mock-h">
              <span>Inbox</span>
              <span style={{ fontSize: "var(--text-2xs)" }}>jack.miller@jobluvo.com</span>
            </div>
            <div className="mail">
              <div>
                <b>Datadog Talent</b>
                <small>Round 2 interview confirmed</small>
              </div>
              <span className="m-tag">Interview</span>
            </div>
            <div className="mail">
              <div>
                <b>Workday</b>
                <small>Verification code 482913</small>
              </div>
              <span className="m-tag">Auto filled</span>
            </div>
            <div className="pipe">
              <div>
                <span>Applied</span>
                <b>27</b>
              </div>
              <div>
                <span>Replied</span>
                <b>4</b>
              </div>
              <div>
                <span>Interviewing</span>
                <b>2</b>
              </div>
              <div>
                <span>Offer</span>
                <b>0</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- and around -- */}
      <section className="m-section tight">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">And around it</div>
            <h2 className="display">Two ways to drive, two people to ask.</h2>
          </div>
          <div className="m-grid g4">
            {aroundIt.map((c) => (
              <div className="m-card" key={c.h}>
                <h3>{c.h}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {c.p}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section tight ruled">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="display">What Jobluvo will not do</h2>
          </div>
          <div className="m-grid g3">
            {willNotDo.map((c) => (
              <div className="m-card" key={c.h}>
                <h3>{c.h}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {c.p}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Band
        title="See it on your own resume."
        body="Upload once, get scored matches in minutes, send the first 25 applications free."
        action="Start free"
      />
    </main>
  );
}
