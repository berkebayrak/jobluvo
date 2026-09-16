import type { Family } from "@/db/schema";
import { ashby } from "./ashby";
import { gem } from "./gem";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { smartrecruiters } from "./smartrecruiters";
import type { Adapter } from "./types";
import { workable } from "./workable";

export const ADAPTERS: Record<Family, Adapter> = {
  greenhouse,
  lever,
  ashby,
  smartrecruiters,
  workable,
  gem,
};

/**
 * Phase 0 seed. Every tenant here answered its feed with a 200 and at least
 * one posting when it was added; scripts/seed.ts checks again before
 * inserting and drops any that no longer do. Domains feed Logo.dev.
 *
 * The other thirteen application systems in CLAUDE.md are next phases.
 */
export const SEED_SOURCES: { family: Family; tenant: string; companyName: string; companyDomain: string }[] = [
  { family: "greenhouse", tenant: "stripe", companyName: "Stripe", companyDomain: "stripe.com" },
  { family: "greenhouse", tenant: "airbnb", companyName: "Airbnb", companyDomain: "airbnb.com" },
  { family: "greenhouse", tenant: "datadog", companyName: "Datadog", companyDomain: "datadoghq.com" },
  { family: "lever", tenant: "spotify", companyName: "Spotify", companyDomain: "spotify.com" },
  { family: "ashby", tenant: "notion", companyName: "Notion", companyDomain: "notion.so" },
  { family: "ashby", tenant: "ramp", companyName: "Ramp", companyDomain: "ramp.com" },
  // SmartRecruiters is list plus detail, budgeted at DETAIL_FETCH_BATCH bodies a
  // run. Bosch was dropped: 4,829 postings at 40 bodies a day never finishes.
  { family: "smartrecruiters", tenant: "Ubisoft2", companyName: "Ubisoft", companyDomain: "ubisoft.com" },
  { family: "workable", tenant: "zego", companyName: "Zego", companyDomain: "zego.com" },
  { family: "gem", tenant: "gem", companyName: "Gem", companyDomain: "gem.com" },
];
