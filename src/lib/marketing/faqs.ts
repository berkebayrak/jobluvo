/**
 * FAQ content, ported verbatim from the delivered marketing site
 * (.claude/skills/jobluvo-design/uploads/05-Website.html).
 *
 * Tuple order is [question, answer], as delivered.
 */

export type Faq = [question: string, answer: string];

export const faqs: Faq[] = [
  ['How does Jobluvo find jobs?','Jobluvo monitors employer career pages on 19 application systems, including Workday, Greenhouse, Lever, Ashby, SmartRecruiters and iCIMS, and checks them every few minutes. Duplicate copies of the same role are combined, and each remaining job is scored against your profile with the reasons shown. You can also add any job link yourself.'],
  ['Does Jobluvo submit applications on my behalf?','Yes. Jobluvo opens the employer\'s application page, creates a candidate account where the portal requires one, completes every step of the form, uploads your tailored resume and submits. The confirmation page and confirmation email are saved as a receipt for each application.'],
  ['Will I get spammed with irrelevant opportunities?','No. Hard filters run before anything is scored: location, work authorization, the companies and keywords you exclude, and any standing instructions you write in your own words. Only roles that pass them reach your feed, and every skip you make teaches the ranking. Auto Apply lanes go further and only send applications above the match bar you set.'],
  ['How long does it take to see opportunities?','Minutes. Upload your resume, confirm the details Jobluvo extracts and add your targets, and your first scored matches appear right away. Career pages are checked every few minutes from then on, so new roles usually show up within the hour they are posted.'],
  ['How does Auto Apply work?','On the Max plan you can create up to five lanes. Each lane has its own resume profile, filters, minimum match quality and standing instructions, and can hold applications for your review before they are sent. All lanes share one daily cap. Jobs that meet a lane\'s bar are applied to automatically and no longer appear in your feed.'],
  ['Which application systems are supported?','Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Workable, iCIMS, Oracle Recruiting, ADP, UKG, Rippling, BambooHR, BreezyHR, JazzHR, Jobvite, Paylocity, Dover, Gem and Zoho Recruit. Support for some employer configurations is enabled after validation, and the product shows you which employers are supported before you apply.'],
  ['What if I\'m not actively job searching?','Jobluvo is built to run quietly in the background. Save the roles you would want next and Daniel tells you which skills and certifications keep appearing in them and what to work on this quarter. Keep one lane at Strong matches, held for your review, and the right role is prepared and waiting for you when it appears. Nothing is sent without you.'],
  ['Can I trust an AI with my career?','You stay in control of every decision that matters. Resumes are built only from facts you confirmed, nothing is invented, and you can review each one before it goes out. Questions Jobluvo cannot answer from your profile are paused and handed to you rather than guessed. Every application has a receipt, and you can pause everything or export your data at any time.'],
];

/** The pricing page shows only these three. Same filter as the delivered site. */
export const pricingFaqs: Faq[] = faqs.filter(([q]) =>
  /Auto Apply|systems|not actively/.test(q),
);
