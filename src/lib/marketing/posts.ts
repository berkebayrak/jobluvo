/**
 * Blog content for the marketing site.
 *
 * Ported from .claude/skills/jobluvo-design/uploads/05-Website.html. The copy is
 * transferred verbatim; only the surrounding types are new. `body` is prebuilt
 * HTML, exactly as the delivered site built it.
 */

export interface Post {
  id: string;
  cat: string;
  date: string;
  featured?: boolean;
  title: string;
  excerpt: string;
  body: string;
}

function tbl(x: string): string {
  const rows = x
    .trim()
    .split("\n")
    .filter((r) => !/^\|[-| ]+\|$/.test(r))
    .map((r) => r.split("|").slice(1, -1).map((c) => c.trim()));
  return `<table><thead><tr>${rows[0].map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows
    .slice(1)
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const P = (t: string): string =>
  t
    .split("\n\n")
    .map((x) =>
      x.startsWith("## ") ? `<h2>${x.slice(3)}</h2>` : x.startsWith("|") ? tbl(x) : `<p>${x}</p>`,
    )
    .join("");

const NOTE =
  '<div class="note">Competitor prices and features are taken from their public pages in September 2026 and can change. Check before you buy.</div>';

export const posts: Post[] = [
{id:'vs-all',cat:'Featured',date:'11 September 2026',featured:true,
 title:'Jobluvo vs every auto apply tool we could find (we tested 12)',
 excerpt:'We ran the same profile through twelve tools for two weeks: Tsenta, Simplify, Jobright, LazyApply, AIApply, Massive, Huntr, Teal and more. Where each one wins, where each one loses, and what an application really costs.',
 body:NOTE+P(`Every tool in this category says it applies for you. Underneath, they do very different things. We created one profile, a strategy manager with ten years of experience who needs sponsorship, and ran it through twelve tools for two weeks. The test was simple: how many verified applications went out, how many of them were to jobs the candidate would actually take, and what it cost.

## Three categories, not twelve tools

Autofill extensions (Simplify, Jobright Turbo, Teal) type your details into a form you found yourself. You still find the job, open the page, log in, answer the screeners and press submit. They save minutes, not hours.

Bulk appliers (LazyApply, Massive, AIApply) push volume, mostly through LinkedIn and Indeed. They send a lot, they answer screening questions with defaults, and some of them do it in ways LinkedIn's rules prohibit.

Full agents (Tsenta, Jobluvo) watch employer career pages, tailor a resume, log in to the employer's portal, complete the application and keep a receipt. This is the only category that applies without you in the loop.

## The numbers from our two weeks

| Tool | Category | Verified applications | Applications to unsuitable roles | Monthly price |
| Jobluvo (Pro) | Full agent | 214 | 3 | USD 35 |
| Tsenta (Pro) | Full agent | 239 | 21 | USD 39 |
| Simplify+ | Autofill | 41 (all manual) | 0 | USD 39.99 |
| Jobright Turbo | Autofill | 38 (all manual) | 0 | USD 29.99 |
| LazyApply | Bulk | 380 (LinkedIn) | 96 | one-time plans |
| AIApply | Bulk | 100 (plan cap) | 14 | USD 50 plus add-ons |
| Massive+ | Bulk | 200 (plan cap) | 22 | USD 99 |

Unsuitable means the role required something the profile does not have, most often US work authorization without sponsorship or an active clearance, and the tool applied anyway.

## Where Jobluvo loses

Tsenta sent more applications in the same two weeks. If raw volume is the only measure, it wins. Simplify's free tier is a good form filler, and if you enjoy browsing job boards you may not need anything else. Jobright's matching is polished.

## Where Jobluvo wins

Fewer wasted applications, because a question the profile cannot answer stops the application instead of being guessed. A Swipe deck that lets you decide job by job when you want to. Up to five lanes with a shared cap when you do not. And two agents, a job search agent and a career coach, that read your real data. No other tool on this list has the second one.

## What an application actually costs

On Jobluvo Pro, USD 35 for up to 1,750 applications a month is two cents each. Tsenta is about 2.6 cents. Massive is 50 cents. Simplify is whatever your time is worth, because you are still doing the applying.`)},
{id:'vs-tsenta',cat:'Tsenta',date:'11 September 2026',
 title:'Jobluvo vs Tsenta, the same idea with a coach and a swipe deck',
 excerpt:'Tsenta is the closest thing to Jobluvo on the market. Both watch career pages and apply on the employer\'s own portal. Here is what is different, priced.',
 body:NOTE+P(`Tsenta is a full agent: it monitors career pages, tailors a resume and submits on the employer's site across 19 application systems. So does Jobluvo. If you are choosing between the two, the differences are in how you pick jobs, what happens when a form asks something unexpected, and who is looking after your career between applications.

## Picking jobs

Tsenta gives you filters and a list, plus lanes for auto apply. Jobluvo gives you the same list, the same lanes, and a Swipe view: one job at a time with the match score and the reasons behind it, salary, level, sponsorship, a summary and the requirements. Right to apply, left to skip, on desktop and phone.

## Unknown questions

When a form asks something your profile does not cover, Jobluvo stops and asks you. In our two-week test Tsenta applied to 21 roles the profile could not take; Jobluvo applied to 3. Fewer applications, far fewer embarrassing ones.

## The coach

Tsenta has a chat assistant. Jobluvo has two agents: Maya, who works on this week's search, and Daniel, a career coach who reads your rejections, saved jobs and profile and tells you what to add, rewrite or prepare. That is the part that compounds over a year.

## Price

| | Jobluvo | Tsenta |
| Entry plan | USD 16 for 750 applications | USD 19 for 600 |
| Middle plan | USD 35 for 1,750 | USD 39 for 1,500 |
| Top plan, auto apply | USD 89 for 5,000 | USD 99 for 4,500 |
| Free applications | 25 | 25 |

## Verdict

If you want the most applications with the least thought, both work and Jobluvo is cheaper per application. If you want to choose your jobs, avoid the ones you should not send, and have someone thinking about the next role, that is what Jobluvo is for.`)},
{id:'vs-simplify',cat:'Simplify',date:'9 September 2026',
 title:'Jobluvo vs Simplify, USD 40 a month to type your name faster',
 excerpt:'Simplify+ is USD 39.99 a month for a browser extension that fills forms you found yourself. Jobluvo finds the job, logs in, answers the screeners and submits. Different product category.',
 body:NOTE+P(`Simplify is a good autofill extension. It remembers your details and drops them into application forms as you browse. The paid tier, Simplify+, is listed at USD 39.99 a month. The question is what you get for that.

## What Simplify does

You find the job. You open it. If the employer portal needs an account, you create it. Simplify fills the fields it recognises. You answer the screening questions. You press submit. It saves perhaps five minutes per application, and nothing happens while you are not at the keyboard.

## What Jobluvo does

Jobluvo finds the job on the employer's career page, often within minutes of it going live. It tailors your resume to the posting, creates the portal account with your Jobluvo address, completes every step, answers screening questions from your confirmed profile, submits, and keeps the confirmation as a receipt. Then it tells you what happened. You can be asleep.

## Price per application

Simplify+ at USD 39.99 for as many applications as you have hours for. Jobluvo Pro at USD 35 for up to 1,750 that you did not have to type. On the Starter plan at USD 16 you get 750.

## Who should pick Simplify

People who enjoy browsing job boards, want to read every posting themselves, and just want less typing. The free tier does most of that.

## Who should pick Jobluvo

People who want the applying handled, want to choose from a scored deck rather than a job board, and want a coach looking at what the market is asking for.`)},
{id:'vs-jobright',cat:'Jobright',date:'9 September 2026',
 title:'Jobluvo vs Jobright Turbo, matching is not applying',
 excerpt:'Jobright Turbo is USD 29.99 a month for AI matching and a polished autofill. Polished or not, an autofill cannot log into a portal, navigate the flow or answer screeners. Jobluvo does the whole thing.',
 body:NOTE+P(`Jobright has one of the better matching engines in the category and a pleasant interface. Turbo, listed at USD 29.99 a month, adds an AI copilot and an autofill. It stops where the work starts.

## The gap

An autofill cannot create the Workday account, cannot handle the email verification, cannot walk the five-step wizard, cannot answer "will you require sponsorship" and cannot press submit for you. Every one of those steps is yours. Jobluvo does all of them and keeps the receipt.

## Matching, compared

Both tools score jobs. Jobluvo shows the reasons behind the score on every card, runs hard filters first (authorization, location, your exclusions) and lets you correct the ranking by skipping. A match score explains fit; it is not a promise of a reply, and Jobluvo says so.

## Price

USD 29.99 for Jobright Turbo, which helps you apply. USD 16 to 35 for Jobluvo Starter or Pro, which applies.

## Verdict

If you want a nicer job board with a copilot, Jobright is that. If you want applications to go out while you are doing something else, you want a full agent.`)},
{id:'vs-lazyapply',cat:'LazyApply',date:'8 September 2026',
 title:'Jobluvo vs LazyApply, why we will not touch your LinkedIn account',
 excerpt:'LazyApply drives LinkedIn Easy Apply and Indeed at volume. LinkedIn\'s rules prohibit it and accounts get restricted. Jobluvo applies on the employer\'s own site instead.',
 body:NOTE+P(`LazyApply is sold on volume: hundreds of applications a day through LinkedIn Easy Apply and Indeed, on one-time plans. In our test it sent 380 applications in two weeks. 96 of them were to roles the profile could not take.

## The LinkedIn problem

LinkedIn's user agreement prohibits bots, scripts and browser extensions that automate activity. Users of LinkedIn automation report warnings, temporary restrictions, identity checks and permanent restrictions. The account at risk is yours, and for most professionals it is also their network.

## What Jobluvo does instead

Most Easy Apply jobs also exist on the employer's own careers site, because that is where they were posted first. When you save a LinkedIn job in Jobluvo, it finds the same role on the employer's site and applies there. Same job, same recruiter, a real receipt, no risk to your account. The rest are saved with an honest "apply on LinkedIn" state.

## Screening questions

LazyApply answers screeners with defaults. Jobluvo answers from your confirmed profile and stops when it does not have an answer. That difference is the 96 applications above.

## Verdict

If you want to fire applications at LinkedIn and accept the risk, LazyApply will do it. Jobluvo will not, on purpose.`)},
{id:'vs-aiapply',cat:'AIApply',date:'8 September 2026',
 title:'Jobluvo vs AIApply, three subscriptions for one job search',
 excerpt:'AIApply lists USD 50 a month for 100 applications, plus paid add-ons for resume and cover letter optimisation. Jobluvo Starter is USD 16 for 750 with tailoring included.',
 body:NOTE+P(`AIApply's headline plan is listed at around USD 50 a month for 100 applications, with resume optimisation and cover letter optimisation sold as separate add-ons at about USD 12 each. That is three subscriptions and roughly 50 cents an application before the add-ons.

## What is included on Jobluvo

Every plan includes resume tailoring and cover letters, because an application without them is not worth sending. Starter is USD 16 for up to 750 applications. Pro is USD 35 for 1,750. There are no add-ons.

## Quality

In our test AIApply sent 14 of its 100 applications to roles the profile could not take. Jobluvo sent 3 of 214. The difference is that Jobluvo pauses on any question it cannot answer from your profile.

## Verdict

Fewer subscriptions, more applications, and a coach. This one is not close.`)},
{id:'vs-massive',cat:'Massive',date:'7 September 2026',
 title:'Jobluvo vs Massive, USD 99 a month for 200 applications',
 excerpt:'Massive+ is listed at USD 99 a month for up to 200 jobs, with a long onboarding and a card-required trial. Jobluvo Max is USD 89 for 5,000 with auto apply lanes.',
 body:NOTE+P(`Massive+ is listed at USD 99 a month for up to 200 applications, which works out at 50 cents each, after an onboarding that took us 23 steps and a four-day trial that asks for a card up front.

## The same money on Jobluvo

Jobluvo Max is USD 89 a month for up to 5,000 applications, five auto apply lanes, review before submit and both agents. Pro is USD 35 for 1,750. Starting is free, with 25 applications and no card.

## Onboarding

Upload a resume, confirm the extracted details, add your work authorization and targets. Most people are swiping through scored matches inside ten minutes.

## Verdict

Massive is a reasonable product with an unreasonable price per application. If you are going to pay USD 99, Jobluvo Max sends thirty times more and thinks harder about each one.`)},
{id:'sponsors',cat:'International Student / OPT',date:'6 September 2026',
 title:'Best auto apply tools for international students targeting sponsoring employers (2026)',
 excerpt:'Half of applying from abroad or on OPT is not wasting applications on roles that were never open to you. How the main tools handle sponsorship, and what to set up.',
 body:P(`If you need sponsorship, a large share of US postings are closed to you and most of them do not say so. A tool cannot change that. It can stop you spending applications, and hope, on the ones that are.

## What to look for

Three things: does the tool read sponsorship language in the posting, does it answer the authorization question exactly as you set it, and does it stop on questions it cannot answer. Bulk tools fail the third test and that is where international candidates get hurt.

## How Jobluvo handles it

Your work authorization, current status, sponsorship need, earliest start and relocation are entered by you and reused exactly as written. Every posting is scanned for sponsorship language: "no sponsorship" rules the job out before scoring, "sponsorship available" is shown as a plus, silence is shown as unknown so you can decide.

## A setup that works

One lane with "sponsors visa" as a hard filter, running unheld. A second lane that allows unknown sponsorship, held for your review, with a standing instruction like "skip anything under 120k, relocation would not be worth it." Ask Daniel which of your saved companies actually sponsor at your level; he reads the postings, not a rumour list.

## Timing

Start earlier than feels necessary. Sponsored hiring has calendar constraints domestic hiring does not, and a lane quietly running for two months before you need it is the best preparation there is.`)},
{id:'newgrads',cat:'New grads',date:'4 September 2026',
 title:'Best auto apply tools with built-in tracking for new grads (2026)',
 excerpt:'New grads apply widely and lose track fast. The tools that apply and track in one place, and how to keep a hundred applications from turning into chaos.',
 body:P(`A first search is wide by nature. Fifty applications become two hundred, replies arrive weeks later, and the spreadsheet dies in week three. The fix is a tool that applies and tracks in the same place, so every reply lands next to the application it belongs to.

## What Jobluvo does for a first search

Every application gets a receipt. Every employer reply lands in your Jobluvo address, gets labelled (confirmation, interview, assessment, rejection) and moves the application along the pipeline: applied, replied, interviewing, offer. Nothing to update by hand.

## The coach matters more for new grads

Daniel reads your saved jobs and tells you which skills and certifications keep appearing, then helps you write the resume sections you do not have experience for yet. Ask him one question a week.

## Setup

Start in Swipe view for the first fifty jobs to learn what you actually say yes to. Then one lane at Strong matches, held for review. Add a second lane for an adjacent role family once the first one is sending things you would have sent anyway.`)},
{id:'response-rate',cat:'Job Search Strategy',date:'2 September 2026',
 title:'How to improve your response rate with auto apply tools in 2026',
 excerpt:'Volume tools sell a number. The number that matters is replies per hundred applications, and it moves for three reasons: fit, timing and wording.',
 body:P(`Track one number: positive employer replies per hundred verified applications. In our pilot it ranges from under 2 to over 12 for people with similar backgrounds. The spread comes from three things.

## Fit is a filter, not a score

A match score explains fit. It does not raise your odds on a job that requires something you do not have. Run hard filters before scoring: authorization, location, exclusions, and standing instructions in your own words like "no roles that are mostly pre-sales." A lane set to Strong matches sends fewer applications and gets more replies than one set to Stretch.

## Early beats many

Many employers review applications in the order they arrive and stop when they have a shortlist. Being in the first fifty matters more than being one of five hundred. Jobluvo checks career pages every few minutes and can apply within the hour a role goes up.

## Say it in their words

Tailoring is leading with the experience the posting asks for, in the words the posting uses. "Built the annual planning cadence" when they ask for planning. Jobluvo does this from facts you confirmed and shows you every change. Anything invented would be caught in the first interview anyway.

## The right goal

Ten applications a day that fit, went in early and read as if written for the job. Then one honest look a week at what replied and what did not, which is exactly what Daniel does.`)},
{id:'career-system',cat:'Career growth',date:'30 August 2026',
 title:'Not job hunting yet? How to use Jobluvo to plan your next move',
 excerpt:'Most people open a job tool the week they get desperate. The better outcome comes from running it quietly for months. Here is the setup.',
 body:P(`A job search that starts the day you need one is a bad job search. Here is how people in our pilot use Jobluvo a year before they intend to move.

## See what the market asks of you

Save the roles you would want next, even if you would not apply today. Daniel reads the postings and tells you which skills, certifications and titles keep appearing, which ones you already have, and which gap is worth closing first.

## Keep a resume that is always ready

Your profile is a set of confirmed facts, not a document you dread reopening. Add a win the week it happens. Every future resume already has it.

## Run one quiet lane

A lane set to Strong matches only, held for your review, sends nothing without you. When the right role appears at 3am, it is prepared and waiting at breakfast. You can say no.

## Once a quarter

Ask Daniel: "If I wanted to be a director in two years, what would I change this quarter?" He answers from your real profile and the jobs you saved, not a generic template.`)},
{id:'resume-tools',cat:'AI Resume Tools',date:'25 August 2026',
 title:'Best AI resume tailoring tools in 2026, and the line between tailoring and lying',
 excerpt:'AI resume tools sit on a spectrum from reorder to rewrite to invent. What the main tools do, and where Jobluvo draws the line.',
 body:P(`Every AI resume tool optimises. Some of them lie. Here is the spectrum, and where Jobluvo sits on it.

## Allowed: order

The most relevant experience leads. If the posting is about planning, your planning work goes first. This is the biggest lever and it changes nothing about the truth.

## Allowed: phrasing

"Managed strategic projects" becomes "Led a three year cost program across four business units" when that is what you did and the posting asks for transformation. Same facts, the employer's vocabulary. You see every change before it is used.

## Never: metrics, titles, dates, employers, skills

No invented percentages, no promoted titles, no stretched dates, no tools you have not used. Jobluvo's generator can only draw on facts you confirmed in your profile, and a check blocks any claim it cannot trace. It is not a policy we ask the model to follow; it is a test the output has to pass.

## Why so strict

An invented claim gets you an interview you cannot survive, at best. Applications go out under your name. The tool making that decision should be the most conservative one in the room.`)},
{id:'fifty',cat:'Job Search Strategy',date:'20 August 2026',
 title:'Applying to 50 jobs a day is the wrong goal',
 excerpt:'"How many can it send?" is the question the category trained everyone to ask. It is the wrong one.',
 body:P(`A day of fifty applications to roles that do not fit produces fifty silences and a worse ranking with the tools you use. What to measure instead, and how to get it up.

## Replies per hundred

Positive employer replies per hundred verified applications. That is the number. Everything else is vanity.

## Fewer, earlier, better worded

Fewer: hard filters and a Strong match bar. Earlier: career pages checked every few minutes, applications within the hour. Better worded: a resume that leads with what the posting asks for, in its own vocabulary, without inventing anything.

## What a good day looks like

Ten applications that fit, went in early and read as if written for the job. A five minute look at what replied. One adjustment to a lane. That is the whole job.`)},
{id:'linkedin',cat:'Job Search Strategy',date:'15 August 2026',
 title:'Why Jobluvo will not automate LinkedIn Easy Apply',
 excerpt:'Every auto apply tool gets asked. What LinkedIn\'s rules say, what happens to accounts, and what we do instead.',
 body:P(`It is the first question on every call: "Does it do Easy Apply?" The answer is no, on purpose.

## The rules are not ambiguous

LinkedIn's user agreement prohibits bots, scripts, browser extensions and any automated method of accessing the service. There is no API a job seeker or a consumer product can use to submit an Easy Apply application. The partner programs that exist are for employers and their applicant tracking systems.

## What happens when tools ignore that

Detection is based on timing, velocity and known extension signatures. Users report warnings, 24 to 72 hour restrictions, identity verification and permanent restriction. The account at risk is yours.

## What we do instead

Most Easy Apply jobs also exist on the employer's own careers site. When you save a LinkedIn job, Jobluvo finds the same role there and applies, with a real receipt and no risk to your account. The rest are saved with an honest "apply on LinkedIn" state, and Daniel still prepares your answers.

## The uncomfortable part

This means Jobluvo sends fewer LinkedIn applications than tools that break the rules. A job search that ends with a restricted LinkedIn account is a bad job search.`)},
];

export const cats: string[] = ['All','Comparisons','International Student / OPT','New grads','Job Search Strategy','Career growth','AI Resume Tools'];
export const vsCats: string[] = ['Tsenta','Simplify','Jobright','LazyApply','AIApply','Massive'];
