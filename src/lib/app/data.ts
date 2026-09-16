/**
 * Mock data for the product screens.
 *
 * Ported verbatim from the delivered app
 * (.claude/skills/jobluvo-design/website/screens/Dashboard.html). Copy, names
 * and numbers are the handoff's; only the types are new. Demo user is Jack
 * Miller, as the design system requires.
 */

import type { Status } from "@/components/data/StatusTag";

export interface Job {
  co: string;
  ab: string;
  title: string;
  loc: string;
  mode: string;
  age: string;
  p: number;
  c: string;
  salary: string;
  exp: string;
  level: string;
  sponsor: string;
  summary: string;
  reqs: string[];
  /** ["y" for, "n" against, "q" open question, text] */
  why: [string, string][];
}

export interface Application {
  co: string;
  t: string;
  r: string;
  l: string;
  st: string;
  d: string;
  note?: string;
}

export interface Lane {
  id: string;
  name: string;
  status: string;
  resume: string;
  filters: string[];
  instr: string;
  quality: string;
  review: boolean;
  tailor: string;
  cover: string;
  today: string;
}

export interface PipelineItem {
  co: string;
  t: string;
  stage: string;
  note: string;
  tag?: string;
  cls?: string;
  lane: string;
  resume: string;
  days: number;
  mail?: number;
  reply?: boolean;
  why?: boolean;
  id?: number;
}

export interface Mail {
  from: string;
  addr: string;
  time: string;
  subj: string;
  pre: string;
  label: string;
  cls: string;
  unread: boolean;
  needs: boolean;
  linked: string | null;
  stage: string | null;
  body: string[];
  folder: string;
  /** The message carries an invite, so the reader offers Add to calendar. */
  cal?: boolean;
  /** Daniel has a prep plan ready for this one. */
  prep?: boolean;
}

export interface ChatMessage {
  0: string;
  1: string;
  2?: string[];
}

export interface Chat {
  n: string;
  t: string;
  m: [string, string, string[]?][];
  q: string[];
}


export const jobs: Job[] = [
  {co:"Salesforce",ab:"SF",title:"Director, Corporate Strategy",loc:"San Francisco, CA",mode:"Hybrid",age:"2 days ago",p:74,c:"c-sky",salary:"USD 190k to 240k",exp:"10+ years",level:"Director",sponsor:"Yes",
   summary:"Shape multi-year strategy for the Industries cloud portfolio, run the annual planning cycle with product and finance, and lead a team of four strategy managers. Reports to the SVP of Strategy.",
   reqs:["10+ years in corporate strategy, consulting or corporate development","Experience running annual planning across multiple business units","Comfort presenting to executive leadership and the board","MBA or equivalent"],
   why:[["y","Led a 3 year cost program across 4 business units"],["y","Annual planning ownership at Arvento matches the core duty"],["y","Posting states visa sponsorship is available"],["n","No enterprise software experience on your profile"]]},
  {co:"Stripe",ab:"ST",title:"Strategy and Operations Lead, Global Payments",loc:"New York, NY",mode:"Hybrid",age:"3 days ago",p:71,c:"c-lilac",salary:"USD 175k to 215k",exp:"8+ years",level:"Senior manager",sponsor:"Not stated",
   summary:"Own the operating cadence for the payments organisation, build the strategic plan with the GM, and run cross-functional programs from analysis to rollout.",
   reqs:["8+ years in strategy, operations or consulting","Strong analytical toolkit, SQL a plus","Track record of running programs end to end","Fintech or payments exposure preferred"],
   why:[["y","Consulting background at Deloitte covers analysis to rollout"],["y","PMO leadership of a 6 person team"],["n","No payments or fintech experience on file"],["q","Sponsorship not stated in the posting"]]},
  {co:"Spotify",ab:"SP",title:"Manager, Strategy and Business Planning",loc:"Remote, US",mode:"Remote",age:"4 days ago",p:69,c:"c-mint",salary:"Not listed",exp:"6+ years",level:"Manager",sponsor:"Unknown",
   summary:"Run the business planning cadence for the Advertising business, build the strategic plan with the executive team and track initiative delivery.",
   reqs:["6+ years in planning or strategy","Experience with OKR or similar frameworks","Advanced modelling and presentation skills","PMP a plus"],
   why:[["y","Planning cadence ownership matches your PMO work"],["y","Remote US role passes your location filter"],["q","PMP not on your profile, Daniel flagged this"],["q","Salary not listed"]]},
  {co:"Mistral AI",ab:"MI",title:"Head of Strategy and Planning",loc:"Paris, FR",mode:"On site",age:"4 days ago",p:66,c:"c-peach",salary:"EUR 140k to 170k",exp:"8+ years",level:"Director",sponsor:"Yes",
   summary:"Build the planning function of a fast growing AI lab: company OKRs, resource allocation across research and product, and board reporting.",
   reqs:["8+ years in strategy or consulting","Experience in a scaling technology company","Fluent English, French a plus"],
   why:[["y","Sponsorship offered, EU relocation possible"],["y","Planning and board reporting match your Arvento role"],["n","Paris is outside your US location filter, shown because you saved Mistral"]]},
  {co:"Datadog",ab:"DD",title:"Sr. Director, Corporate Strategy",loc:"New York, NY",mode:"Hybrid",age:"10 hours ago",p:64,c:"c-lilac",salary:"USD 210k to 260k",exp:"12+ years",level:"Senior director",sponsor:"Unknown",
   summary:"Lead corporate strategy for a public infrastructure software company: market entry, M&A screening, and long range planning with the CFO.",
   reqs:["12+ years in strategy, banking or consulting","M&A or corporate development experience","Public company exposure"],
   why:[["y","Consulting and transformation background fits"],["n","12 years asked, you have 10"],["n","No M&A experience on file"]]},
  {co:"Nvidia",ab:"NV",title:"Business Operations Manager, Enterprise",loc:"Austin, TX",mode:"Remote",age:"8 hours ago",p:61,c:"c-mint",salary:"USD 160k to 200k",exp:"7+ years",level:"Manager",sponsor:"Yes",
   summary:"Manage planning, forecasting and operating reviews for the enterprise software group. Partner with sales and finance on quarterly targets.",
   reqs:["7+ years in business operations or strategy","People management","Experience with forecasting tools"],
   why:[["y","Nvidia sponsors visas on this posting"],["y","Business analyst background at Turkcell"],["q","Forecasting tools not clearly stated on your profile"]]},
  {co:"Shopify",ab:"SH",title:"Senior Manager, Strategy and Technology",loc:"Toronto, CA",mode:"Remote",age:"4 days ago",p:60,c:"c-sand",salary:"Not listed",exp:"7+ years",level:"Senior manager",sponsor:"Unknown",
   summary:"Shape platform strategy for merchant tooling, from discovery to roadmap, working with product leadership.",
   reqs:["7+ years in consulting or strategy","Technology fluency","Strong writing, Shopify works in documents"],
   why:[["y","Consulting background fits"],["q","Salary not listed"],["q","Canada requires a separate work permit, not on your profile"]]},
  {co:"Revolut",ab:"RE",title:"Strategy and Operations Director",loc:"London, UK",mode:"Hybrid",age:"3 hours ago",p:58,c:"c-rose",salary:"GBP 130k+",exp:"10+ years",level:"Director",sponsor:"Yes",
   summary:"Lead strategic initiatives for a business line, from case to delivery, with a small team of analysts.",
   reqs:["10+ years in consulting or operations","Comfort with data and speed"],
   why:[["y","Sponsorship offered"],["n","London is outside your US filter, shown because you saved Revolut"]]}
];


export const chats: Record<string, Chat[]> = {
  search:[
    {n:"Account manager noise in feed",t:"Today",m:[["u","Why am I seeing so many account manager roles?"],["b","Your Strategy lane includes \"client strategy\" as a keyword and eleven sales listings matched on that phrase. I can add \"account manager\" and \"sales\" to that lane's exclusions. Preview shows 14 fewer matches this week, all below 62%.",["Apply exclusion","Show the 14"]]],
      q:["Which of today's matches should I look at first?","Find 10 companies hiring strategy roles in New York that are not in my feed","Why is my match score low for the Mistral AI role?"]},
    {n:"Salesforce application check",t:"Today",m:[["u","Check the Salesforce application before it goes out."],["b","The tailored resume moves your Arvento cost program to the top and keeps every date and title as verified. One gap: the form asks about export control status and your profile has no answer, so it is on hold until you fill it in.",["Answer now","Open the packet"]]],q:["What did you change in the resume?","Hold all Salesforce applications for review"]},
    {n:"Companies in New York",t:"Yesterday",m:[["u","Find strategy teams in New York that are not in my feed."],["b","Twelve companies hire for strategy roles in New York on supported portals and are not in your registry yet: Datadog, Squarespace, Peloton, Oscar Health, Ramp, Justworks and six more. Add them to your Strategy lane?",["Add all 12","Show the list"]]],q:["Which of them sponsor visas?"]},
    {n:"Why Mistral scored 66%",t:"Wed",m:[["u","Why is my match score low for the Mistral AI role?"],["b","Paris sits outside your US location filter, so location counts against it. Everything else scores well: planning, board reporting and sponsorship. If you open the filter to EU roles it would score 81%.",["Open filter to EU"]]],q:["Show other EU roles like this"]}
  ],
  coach:[
    {n:"Director-level readiness",t:"Today",m:[["u","What would make me a stronger candidate for director-level strategy roles?"],["b","Your last 6 rejections skew to roles asking for P&L ownership and a completed transformation program. Two moves that show up in the postings you like: a PMP or an equivalent program certification, and one written case study on the cost program you led in 2024. I drafted a 90 day plan.",["Open plan","Rewrite my summary"]]],
      q:["Review my resume summary against my target roles","Which certifications appear most in the jobs I save?","How do I position a career change into product strategy?"]},
    {n:"Datadog interview prep",t:"Today",m:[["u","Prepare me for the Datadog panel on Tuesday."],["b","A 25 minute plan: one case walkthrough on market entry prioritisation, three stories from your cost program mapped to their likely questions, and two questions to ask the panel. Want to rehearse the case now?",["Start rehearsal","Open plan"]]],q:["What do they usually ask in round 2?"]},
    {n:"Resume summary rewrite",t:"Mon",m:[["u","Rewrite my summary for director roles."],["b","Draft: Strategy and transformation leader with 10 years across consulting and industry. Led a 3 year cost program across 4 business units at Arvento and built the planning function from scratch. Only verified facts, nothing new claimed.",["Use this","Try a shorter one"]]],q:["Make it sound less formal"]},
    {n:"PMP or not",t:"Last week",m:[["u","Is a PMP worth it for me?"],["b","It appears in 9 of the 24 jobs you saved this month, mostly at Spotify, Salesforce and the consulting firms. It is not a gate for the director roles you want, but it would remove a recurring question. Roughly 8 weeks of evenings.",["Add to 90 day plan"]]],q:["What about a strategy certificate instead?"]}
  ]
};

const extraCos: [string, string][] = [["Salesforce","Director, Corporate Strategy"],["Stripe","Strategy and Operations Lead"],["Spotify","Manager, Strategy and Business Planning"],["Datadog","Sr. Director, Corporate Strategy"],["Nvidia","Business Operations Manager"],["Shopify","Senior Manager, Strategy and Technology"],["Revolut","Strategy and Operations Director"],["Snowflake","Strategy Manager, Go to Market"],["Airbnb","Head of Business Strategy"],["Notion","Business Operations Lead"],["Deloitte","Manager, Strategy Consulting"],["Uber","Group Product Manager, Growth"],["Atlassian","Senior Program Manager"],["Zillow","Strategy Manager"],["Databricks","Senior Strategy Analyst"],["Mistral AI","Head of Strategy and Planning"]];
const days: string[] = ["Yesterday","2 days ago","3 days ago","4 days ago","5 days ago","6 days ago","Last week","Last week","2 weeks ago","2 weeks ago","3 weeks ago"];
export const apps: Application[] = [
  {co:"Mistral AI",t:"Head of Strategy and Planning",r:"Strategy v3",l:"Strategy and planning",st:"Submitted",d:"Today 14:12"},
  {co:"Salesforce",t:"Director, Corporate Strategy",r:"Strategy v3",l:"Strategy and planning",st:"Needs you",d:""},
  {co:"Stripe",t:"Strategy and Operations Lead",r:"Strategy v3",l:"Strategy and planning",st:"In flight",d:"Today 13:51",note:"Verifying submission"},
  {co:"Datadog",t:"Sr. Director, Corporate Strategy",r:"PM v2",l:"Product management",st:"Held for review",d:""},
  {co:"Atlassian",t:"Group Product Manager, Growth",r:"PM v2",l:"Product management",st:"Held for review",d:""},
  {co:"Airbnb",t:"Head of Business Strategy",r:"Strategy v3",l:"Manual",st:"Failed",d:"Yesterday",note:"Portal closed the role"},
  {co:"Spotify",t:"Manager, Strategy and Business Planning",r:"Strategy v3",l:"Strategy and planning",st:"In flight",d:"Today 14:05",note:"Filling form"},
  {co:"Nvidia",t:"Business Operations Manager",r:"Strategy v3",l:"Strategy and planning",st:"In flight",d:"Today 14:08",note:"Creating employer account"},
];
for (let k = 0; k < 33; k++) {
  const c = extraCos[(k * 5) % extraCos.length];
  apps.push({
    co: c[0],
    t: c[1],
    r: k % 3 ? "Strategy v3" : "PM v2",
    l: k % 4 === 0 ? "Product management" : k % 7 === 0 ? "Manual" : "Strategy and planning",
    st: "Submitted",
    d: days[Math.min(days.length - 1, Math.floor(k / 3))],
  });
}

export const lanes: Lane[] = [
  {id:'strategy',name:'Strategy and planning',status:'Running',resume:'Strategy v3',filters:['Location: US remote, New York or San Francisco','Seniority: manager to director','Exclude: sales, account manager'],instr:'Skip anything that needs an active security clearance or export control status. Skip roles that are mostly pre-sales. No staffing agencies.',quality:'Strong',review:false,tailor:'Honest',cover:'When asked',today:'7 sent'},
  {id:'pm',name:'Product management',status:'Running',resume:'PM v2',filters:['Workplace: remote only','Seniority: senior manager and above'],instr:'Only product roles with a strategy or platform angle. Skip consumer growth roles.',quality:'Strong',review:true,tailor:'Honest',cover:'When asked',today:'2 held'},
  {id:'consulting',name:'Consulting',status:'Paused',resume:'Strategy v3',filters:['Companies: Big 4 and boutique strategy firms','Location: US'],instr:'',quality:'Good',review:false,tailor:'Aggressive',cover:'Always',today:'Paused 9 Sep'}
];

export const stages = ['Applied','Replied','Interviewing','Offer','Rejected','Ghosted'] as const;
export const pipeline: PipelineItem[] = [
  {co:'Mistral AI',t:'Head of Strategy and Planning',stage:'Applied',note:'Today',tag:'No reply yet',cls:'',lane:'Strategy and planning',resume:'Strategy v3',days:0},
  {co:'Nvidia',t:'Business Operations Manager',stage:'Applied',note:'Yesterday',tag:'No reply yet',cls:'',lane:'Strategy and planning',resume:'Strategy v3',days:1},
  {co:'Deloitte',t:'Manager, Strategy Consulting',stage:'Applied',note:'3 days',tag:'Confirmed',cls:'ok',lane:'Consulting',resume:'Strategy v3',days:3},
  {co:'Revolut',t:'Strategy and Operations Director',stage:'Applied',note:'4 days',tag:'Confirmed',cls:'ok',lane:'Strategy and planning',resume:'Strategy v3',days:4},
  {co:'Snowflake',t:'Strategy Manager, Go to Market',stage:'Replied',note:'Assessment sent',tag:'Due Mon',cls:'warn',lane:'Strategy and planning',resume:'Strategy v3',days:6,mail:1},
  {co:'Airbnb',t:'Head of Business Strategy',stage:'Replied',note:'Recruiter question',reply:true,lane:'Manual',resume:'Strategy v3',days:8,mail:2},
  {co:'Notion',t:'Business Operations Lead',stage:'Replied',note:'Availability asked',reply:true,lane:'Product management',resume:'PM v2',days:9},
  {co:'Datadog',t:'Sr. Director, Corporate Strategy',stage:'Interviewing',note:'Round 2',tag:'Tue 10:00 CT',cls:'info',lane:'Product management',resume:'PM v2',days:12,mail:0},
  {co:'Stripe',t:'Director, Corporate Strategy',stage:'Interviewing',note:'Screen',tag:'Thu 15:00 ET',cls:'info',lane:'Strategy and planning',resume:'Strategy v3',days:10},
  {co:'Uber',t:'Group Product Manager, Growth',stage:'Rejected',note:'Auto reply',why:true,lane:'Product management',resume:'PM v2',days:5,mail:5},
  {co:'Atlassian',t:'Senior Program Manager',stage:'Rejected',note:'After screen',lane:'Product management',resume:'PM v2',days:14},
  {co:'Deloitte',t:'Manager, Strategy Consulting',stage:'Rejected',note:'After screen',lane:'Consulting',resume:'Strategy v3',days:20},
  {co:'Zillow',t:'Strategy Manager',stage:'Rejected',note:'Auto reply',lane:'Strategy and planning',resume:'Strategy v3',days:22},
  {co:'Shopify',t:'Senior Manager, Strategy and Technology',stage:'Rejected',note:'After round 1',lane:'Strategy and planning',resume:'Strategy v3',days:25},
  {co:'Snowflake',t:'Senior Strategy Analyst',stage:'Rejected',note:'Auto reply',lane:'Strategy and planning',resume:'Strategy v3',days:30},
  {co:'Zillow',t:'Strategy Manager',stage:'Ghosted',note:'No reply in 47 days',lane:'Strategy and planning',resume:'Strategy v3',days:47},
  {co:'Databricks',t:'Senior Strategy Analyst',stage:'Ghosted',note:'No reply in 62 days',lane:'Manual',resume:'Strategy v3',days:62},
];
apps.filter(a=>a.st==='Submitted').slice(4,27).forEach((a,k)=>pipeline.push({co:a.co,t:a.t,stage:'Applied',note:a.d,tag:'Confirmed',cls:'ok',lane:a.l,resume:a.r,days:5+k}));
pipeline.forEach((p,i)=>p.id=i);
apps
  .filter((a) => a.st === "Submitted")
  .slice(4, 27)
  .forEach((a, k) =>
    pipeline.push({
      co: a.co,
      t: a.t,
      stage: "Applied",
      note: a.d,
      tag: "Confirmed",
      cls: "ok",
      lane: a.l,
      resume: a.r,
      days: 5 + k,
    }),
  );
pipeline.forEach((p, i) => (p.id = i));

export const mails: Mail[] = [
  {from:'Datadog Talent',addr:'talent@datadoghq.com',time:'14:02',subj:'Round 2 interview confirmed: Tuesday 15 Sep',pre:'Hi Jack, thanks for confirming. Your panel will be...',label:'Interview',cls:'info',unread:true,needs:false,linked:'Datadog, Sr. Director, Corporate Strategy',stage:'Interviewing',body:['Hi Jack,','Thanks for confirming. Your second round will be a 60 minute panel with the VP of Corporate Strategy and two senior directors. Please expect a short case discussion on prioritising a market entry roadmap for a new product line, followed by questions on your experience.','The video link is attached to the calendar invite. Let us know if you need any accommodations.','Best regards,<br>Datadog Talent Acquisition'],prep:true,cal:true,folder:'inbox'},
  {from:'Snowflake Careers',addr:'careers@snowflake.com',time:'11:30',subj:'Your assessment link (expires in 72 hours)',pre:'Please complete the situational judgement test...',label:'Assessment',cls:'warn',unread:true,needs:false,linked:'Snowflake, Strategy Manager, Go to Market',stage:'Replied',body:['Hi Jack,','Please complete the situational judgement test at the link below within 72 hours. It takes about 35 minutes.','Good luck,<br>Snowflake Talent Team'],folder:'inbox'},
  {from:'Dana at Airbnb',addr:'dana.k@airbnb.com',time:'09:48',subj:'Quick question about your availability',pre:'Jack, before we move ahead I wanted to check...',label:'Recruiter',cls:'lilac',unread:true,needs:true,linked:'Airbnb, Head of Business Strategy',stage:'Replied',body:['Jack,','Before we move ahead I wanted to check whether you could start before December, and whether relocation to San Francisco is on the table for you.','Thanks,<br>Dana'],folder:'inbox'},
  {from:'Mistral AI',addr:'no-reply@mistral.ai',time:'Yesterday',subj:'We received your application',pre:'Thank you for applying to Head of Strategy and Planning...',label:'Confirmation',cls:'ok',unread:false,needs:false,linked:'Mistral AI, Head of Strategy and Planning',stage:'Applied',body:['Thank you for applying to Head of Strategy and Planning. Our team will review your application and get back to you.'],folder:'inbox'},
  {from:'Workday',addr:'noreply@myworkday.com',time:'Yesterday',subj:'Your verification code is 482913',pre:'Used automatically for Stripe account setup',label:'Verification, auto filled',cls:'',unread:false,needs:false,linked:'Stripe, Director, Corporate Strategy',stage:'Applied',body:['Your verification code is 482913. It expires in 10 minutes.','<span class="tag ok">Matched to the Stripe account setup and filled in automatically at 13:49.</span>'],folder:'inbox'},
  {from:'Uber',addr:'talent@uber.com',time:'Wed',subj:'Update on your application',pre:'After careful consideration we have decided...',label:'Rejection',cls:'bad',unread:false,needs:false,linked:'Uber, Group Product Manager, Growth',stage:'Rejected',body:['Hi Jack,','After careful consideration we have decided to move forward with other candidates for this role. We appreciate your interest in Uber.','Uber Talent Team'],folder:'inbox'},
  {from:'Deloitte Talent',addr:'talent@deloitte.com',time:'Tue',subj:'Application received: Manager, Strategy Consulting',pre:'Thanks for your interest in Deloitte...',label:'Confirmation',cls:'ok',unread:false,needs:false,linked:'Deloitte, Manager, Strategy Consulting',stage:'Applied',body:['Thanks for your interest in Deloitte. Your application for Manager, Strategy Consulting has been received.'],folder:'inbox'},
  {from:'Notion',addr:'recruiting@makenotion.com',time:'Mon',subj:'Are you available next week?',pre:'We would love to set up a 30 minute call...',label:'Recruiter',cls:'lilac',unread:false,needs:true,linked:'Notion, Business Operations Lead',stage:'Replied',body:['Hi Jack,','We would love to set up a 30 minute call next week. Could you share a few slots that work in your time zone?','Best,<br>Notion Recruiting'],folder:'inbox'},
  {from:'Stripe',addr:'recruiting@stripe.com',time:'Mon',subj:'Screen scheduled: Thursday 15:00 ET',pre:'Your call with the hiring manager is confirmed...',label:'Interview',cls:'info',unread:false,needs:false,linked:'Stripe, Director, Corporate Strategy',stage:'Interviewing',body:['Your call with the hiring manager is confirmed for Thursday at 15:00 ET. The invite is attached.'],cal:true,folder:'inbox'},
  {from:'Spotify',addr:'jobs@spotify.com',time:'Sun',subj:'Application received',pre:'Thanks for applying to Manager, Strategy and Business Planning...',label:'Confirmation',cls:'ok',unread:false,needs:false,linked:'Spotify, Manager, Strategy and Business Planning',stage:'Applied',body:['Thanks for applying to Manager, Strategy and Business Planning. We will be in touch.'],folder:'inbox'},
  {from:'Atlassian',addr:'talent@atlassian.com',time:'Last week',subj:'Your application status',pre:'We have decided not to proceed...',label:'Rejection',cls:'bad',unread:false,needs:false,linked:'Atlassian, Senior Program Manager',stage:'Rejected',body:['We have decided not to proceed with your application at this time. Thank you for your interest.'],folder:'inbox'},
  {from:'Revolut',addr:'people@revolut.com',time:'Last week',subj:'Application received',pre:'Thanks for applying...',label:'Confirmation',cls:'ok',unread:false,needs:false,linked:'Revolut, Strategy and Operations Director',stage:'Applied',body:['Thanks for applying to Revolut. We will review your application shortly.'],folder:'inbox'},
  {from:'Nvidia',addr:'careers@nvidia.com',time:'Last week',subj:'Application received',pre:'Thank you for your application...',label:'Confirmation',cls:'ok',unread:false,needs:false,linked:'Nvidia, Business Operations Manager',stage:'Applied',body:['Thank you for your application. Our team will review it and reach out if there is a fit.'],folder:'inbox'},
  {from:'Sam at Ramp',addr:'sam@ramp.com',time:'Last week',subj:'Saw your profile',pre:'We are hiring a strategy lead...',label:'Recruiter',cls:'lilac',unread:false,needs:false,linked:null,stage:null,body:['Hi Jack, we are hiring a strategy lead at Ramp and your background looks relevant. Open to a chat?'],folder:'inbox'},
];

/** Execution status on the dashboard, mapped to the design system StatusTag. */
export const statusMap: Record<string, Status> = {
  Submitted: "submitted",
  "In flight": "verifying",
  "Needs you": "needs",
  "Held for review": "held",
  Failed: "failed",
  Skipped: "ghosted",
};

/** Tracker stages map straight onto StatusTag. */
export const stageMap: Record<string, Status> = {
  Applied: "applied",
  Replied: "replied",
  Interviewing: "interviewing",
  Offer: "offer",
  Rejected: "rejected",
  Ghosted: "ghosted",
};

export const statusFilters = ["All","Submitted","In flight","Needs you","Held for review","Failed"];

/** Company domains for Logo.dev. */
export const domains: Record<string, string> = {
  Salesforce: "salesforce.com", Stripe: "stripe.com", Spotify: "spotify.com",
  "Mistral AI": "mistral.ai", Datadog: "datadoghq.com", Nvidia: "nvidia.com",
  Shopify: "shopify.com", Revolut: "revolut.com", Snowflake: "snowflake.com",
  Airbnb: "airbnb.com", Notion: "notion.so", Deloitte: "deloitte.com",
  "Deloitte Talent": "deloitte.com", Uber: "uber.com", Atlassian: "atlassian.com",
  Zillow: "zillow.com", Databricks: "databricks.com", Workday: "workday.com",
  Ramp: "ramp.com", "Snowflake Careers": "snowflake.com",
  "Datadog Talent": "datadoghq.com", "Dana at Airbnb": "airbnb.com",
  "Sam at Ramp": "ramp.com",
};
