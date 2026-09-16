import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/core/Button";
import { AtsStrip } from "@/components/marketing/AtsStrip";
import { Band } from "@/components/marketing/Band";
import { FaqList } from "@/components/marketing/FaqList";
import { AgentFace } from "@/components/marketing/AgentFace";
import { HeroDemo } from "@/components/marketing/HeroDemo";
import { PricingBlock } from "@/components/marketing/PricingBlock";
import { faqs } from "@/lib/marketing/faqs";
import { steps } from "@/lib/marketing/content";
import { logoUrl } from "@/lib/logo";

export const metadata: Metadata = {
  title: "Jobluvo. Every job that fits you, applied to first.",
  description:
    "Jobluvo scans career pages, applies to the roles that fit you with a resume that stays truthful, and coaches you toward the ones you want next.",
};

export default function HomePage() {
  return (
    <main>
      {/* ------------------------------------------------------------ hero -- */}
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="pill">
              <i>New</i> Swipe view. Pick your jobs one card at a time.
            </span>
            <h1 className="display">
              Find your dream job. <em>Build your career system.</em>
            </h1>
            <p className="lead">
              Jobluvo scans <b data-provisional>100,000+</b> career pages, applies to the
              roles that fit you with a resume that stays truthful, and coaches you toward
              the ones you want next. Whether you are looking now or planning ahead, it
              works on your career every day.
            </p>
            <div className="ctas">
              <Link href="/signup">
                <Button variant="primary" size="lg">
                  Start free
                </Button>
              </Link>
              <Link href="/#how">
                <Button size="lg">See how it works</Button>
              </Link>
            </div>
            <div className="fine">No card needed. Your first 25 applications are free.</div>
          </div>
          <HeroDemo />
        </div>
      </section>

      <AtsStrip />

      {/* -------------------------------------------------- everything you -- */}
      <section className="m-section tight" id="how">
        <div className="wrap">
          <h2 className="big reveal">Everything you need to land your next job</h2>

          <div className="topic reveal">
            <h3>Jobluvo, your career engine</h3>
          </div>
          <div className="fgrid">
            <div className="fcard reveal">
              <div className="mock2">
                <div className="mh2">
                  <span>New matches</span>
                  <span>today at 08:12</span>
                </div>
                <div className="jrow">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs */}
                  <img src={logoUrl("salesforce.com")} alt="Salesforce" />
                  <div>
                    <span>Director, Corporate Strategy</span>
                    <small>Salesforce. San Francisco. USD 190k to 240k</small>
                  </div>
                  <em className="pct">74%</em>
                </div>
                <div className="jrow d2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs */}
                  <img src={logoUrl("stripe.com")} alt="Stripe" />
                  <div>
                    <span>Strategy and Operations Lead</span>
                    <small>Stripe. New York. USD 175k to 215k</small>
                  </div>
                  <em className="pct">71%</em>
                </div>
                <div className="jrow d3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs */}
                  <img src={logoUrl("spotify.com")} alt="Spotify" />
                  <div>
                    <span>Manager, Strategy and Planning</span>
                    <small>Spotify. Remote, US</small>
                  </div>
                  <em className="pct">69%</em>
                </div>
              </div>
              <h4>Find</h4>
              <p>
                Career pages on 19 application systems are checked every few minutes. Each
                new role is scored against your resume with the reasons shown, ready to
                swipe&nbsp;through.
              </p>
            </div>

            <div className="fcard reveal">
              <div className="mock2">
                <div className="mh2">
                  <span>stripe.com/jobs/apply</span>
                  <span className="live">Applying</span>
                </div>
                <div className="fld2">
                  <label>Name</label>
                  <span className="typed t1">Jack Miller</span>
                </div>
                <div className="fld2">
                  <label>Email</label>
                  <span className="typed t2">jack.miller@jobluvo.com</span>
                </div>
                <div className="fld2">
                  <label>Resume</label>
                  <span className="typed t3">Strategy_v3_Stripe.pdf</span>
                </div>
                <div className="sub2">Submit application</div>
                <div className="done2">Submitted. Receipt saved</div>
              </div>
              <h4>Apply</h4>
              <p>
                Jobluvo creates the employer account, completes every step of the form and
                submits. Set a lane and it applies to strong matches while you sleep.
                Unknown questions wait for&nbsp;you.
              </p>
            </div>

            <div className="fcard reveal">
              <div className="mock2">
                <div className="mh2">
                  <span>Inbox</span>
                  <span>jack.miller@jobluvo.com</span>
                </div>
                <div className="env2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs */}
                  <img src={logoUrl("datadoghq.com")} alt="Datadog" />
                  <div>
                    <span>Datadog Talent</span>
                    <small>Round 2 interview confirmed, Tuesday 10:00</small>
                  </div>
                  <em>Interview</em>
                </div>
                <div className="env2 e2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs */}
                  <img src={logoUrl("snowflake.com")} alt="Snowflake" />
                  <div>
                    <span>Snowflake Careers</span>
                    <small>Your assessment link, due Monday</small>
                  </div>
                  <em>Assessment</em>
                </div>
                <div className="pipe3">
                  <span>
                    Applied <b>27</b>
                  </span>
                  <span>
                    Replied <b>4</b>
                  </span>
                  <span className="hot">
                    Interviewing <b>2</b>
                  </span>
                  <span>
                    Offer <b>0</b>
                  </span>
                </div>
              </div>
              <h4>Track</h4>
              <p>
                Employer replies land in your Jobluvo inbox, get labelled and linked to the
                right application, and move it along the pipeline without any manual&nbsp;updates.
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------- maya -- */}
          <div className="topic reveal">
            <h3>
              <AgentFace
                src="https://randomuser.me/api/portraits/women/44.jpg"
                alt="Maya"
                initial="M"
              />
              Maya, your job preparation coach
            </h3>
          </div>
          <div className="fgrid">
            <div className="fcard reveal">
              <div className="mock2 chat">
                <div className="mh2">
                  <span>0:04</span>
                  <span>Maya</span>
                </div>
                <div className="bub u">
                  Director roles in strategy, New York or remote. Skip anything mostly
                  pre-sales.
                </div>
                <div className="bub a">
                  Got it. That rules out 11 of today&apos;s 42 matches. Here are the 6 that
                  fit best, and I added &quot;pre-sales&quot; to your lane&apos;s exclusions.
                </div>
                <div className="bub a c3">
                  Datadog and Stripe are new since this morning. Want me to prepare both?
                </div>
              </div>
              <h4>Tailored job hunting</h4>
              <p>
                Tell Maya what you want in plain words. She tunes your feed, finds companies
                you have not seen and prepares each application from facts you&nbsp;confirmed.
              </p>
            </div>

            <div className="fcard reveal">
              <div className="mock2 chat">
                <div className="mh2">
                  <span>0:12</span>
                  <span>Maya</span>
                </div>
                <div className="bub a">
                  Tell me about a program you led under cost pressure.
                </div>
                <div className="bub u c2">
                  I led a three year cost program across four business units. We hit the
                  target a quarter early.
                </div>
                <div className="score">
                  <span>Confidence score</span>
                  <b>87%</b>
                  <i />
                </div>
              </div>
              <h4>Mock interviews</h4>
              <p>
                Practice with questions drawn from the actual posting. Maya scores clarity
                and evidence, tightens your stories and flags what the panel will push&nbsp;on.
              </p>
            </div>

            <div className="fcard reveal">
              <div className="mock2">
                <div className="mh2">
                  <span>Salary benchmark</span>
                  <span>Director, strategy, US</span>
                </div>
                <div className="brow2">
                  <span>Market 50th</span>
                  <i style={{ ["--w" as string]: "62%" }} />
                  <b>$168k</b>
                </div>
                <div className="brow2 you">
                  <span>Your target</span>
                  <i style={{ ["--w" as string]: "70%" }} />
                  <b>$185k</b>
                </div>
                <div className="brow2">
                  <span>Market 90th</span>
                  <i style={{ ["--w" as string]: "92%" }} />
                  <b>$240k</b>
                </div>
                <div className="bnote">
                  Based on 312 postings with a published range in the last 90 days.
                </div>
              </div>
              <h4>Salary benchmarking</h4>
              <p>
                See what good looks like for your role, level and location from real
                postings, so the number you put on every form is one you can&nbsp;defend.
              </p>
            </div>
          </div>

          {/* ----------------------------------------------------- daniel -- */}
          <div className="topic reveal">
            <h3>
              <AgentFace
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="Daniel"
                initial="D"
              />
              Daniel, your career coach
            </h3>
          </div>
          <div className="fgrid">
            <div className="fcard reveal">
              <div className="mock2">
                <div className="mh2">
                  <span>Career plan</span>
                  <span>Director of Strategy by 2028</span>
                </div>
                <div className="tl">
                  <div className="tick on">
                    <b>Now</b>
                    <span>Head of Strategy and PMO</span>
                  </div>
                  <div className="tick t2">
                    <b>Q1 2027</b>
                    <span>Program certification, case study written</span>
                  </div>
                  <div className="tick t3">
                    <b>Q4 2027</b>
                    <span>Senior manager, strategy, at a US software company</span>
                  </div>
                  <div className="tick t4">
                    <b>2028</b>
                    <span>Director of Strategy</span>
                  </div>
                </div>
              </div>
              <h4>Career plan</h4>
              <p>
                Tell Daniel where you want to be in two years. He turns it into a plan with
                milestones, checks it against the roles you save and updates it as you&nbsp;grow.
              </p>
            </div>

            <div className="fcard reveal">
              <div className="mock2">
                <div className="mh2">
                  <span>Skills in your target roles</span>
                  <span>24 saved jobs</span>
                </div>
                <div className="brow2">
                  <span>P&amp;L ownership</span>
                  <i style={{ ["--w" as string]: "75%" }} />
                  <b>18 of 24</b>
                </div>
                <div className="brow2">
                  <span>Program certification</span>
                  <i style={{ ["--w" as string]: "38%" }} />
                  <b>9 of 24</b>
                </div>
                <div className="brow2 have">
                  <span>Annual planning</span>
                  <i style={{ ["--w" as string]: "88%" }} />
                  <b>You have it</b>
                </div>
                <div className="bnote">
                  Suggested next: one written case study on your cost program.
                </div>
              </div>
              <h4>Skills and certifications</h4>
              <p>
                Daniel reads the postings you want and shows which skills, certifications
                and titles keep appearing, which you already have, and which gap to close&nbsp;first.
              </p>
            </div>

            <div className="fcard reveal">
              <div className="mock2">
                <div className="mh2">
                  <span>Quarterly review</span>
                  <span>Q3 2026</span>
                </div>
                <div className="chk">38 applications, 6 replies, 2 interviews</div>
                <div className="chk c2">Case study drafted, 2 rounds of edits</div>
                <div className="chk c3">Summary rewritten for director roles</div>
                <div className="chk c4 next">
                  Next quarter: certification exam, 3 outreach messages a week
                </div>
              </div>
              <h4>Quarterly career review</h4>
              <p>
                Every quarter Daniel reviews what replied and what did not, what you shipped
                on the plan, and sets the next three months. Progress you can actually&nbsp;see.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- steps -- */}
      <section className="m-section tight">
        <div className="wrap">
          <h2 className="big reveal">From resume to offer, in 5 steps.</h2>
          <div className="sgrid">
            {steps.map((s) => (
              <div className="scard reveal" key={s.n}>
                <div className="sn">{s.n}</div>
                <h4>{s.h}</h4>
                <p>{s.p}</p>
              </div>
            ))}
            <div className="scard cta reveal">
              <h4>Ready to get started?</h4>
              <p>Upload a resume and see your first matches in minutes.</p>
              <Link href="/signup">
                Sign up free
                <ChevronRight size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- pricing -- */}
      <section className="m-section tight ruled" id="pricing">
        <div className="wrap">
          <h2 className="big reveal" style={{ marginBottom: 8 }}>
            Start free. Upgrade when it works.
          </h2>
          {/* Fine print from the delivered pricing page, which is now this section. */}
          <p className="lead" style={{ maxWidth: 640, marginTop: 0, marginBottom: 28 }}>
            Start with 25 free applications. One verified submission uses one application.
            Failed or withdrawn attempts are never counted.
          </p>
          <PricingBlock />

        </div>
      </section>

      {/* ------------------------------------------------------------- faq -- */}
      <section className="m-section tight" id="faq">
        <div className="wrap faqwrap">
          <h2 className="big reveal">FAQs</h2>
          <div className="faqbox reveal">
            <FaqList items={faqs} />
          </div>
        </div>
      </section>

      <Band
        title="Start today. The first 25 applications are free."
        body="Upload your resume, confirm the facts, choose a few targets. Jobluvo takes it from there."
        action="Create your account"
      />
    </main>
  );
}
