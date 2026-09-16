"use client";

import * as React from "react";
import { Button } from "@/components/core/Button";
import { Card } from "@/components/data/Card";
import { Toggle } from "@/components/core/Toggle";
import { showToast } from "@/components/feedback/Toaster";
import { SourcesCard } from "@/components/app/SourcesCard";
import { plans, prices } from "@/lib/marketing/pricing";

const TABS = [
  "Plan and usage",
  "Account",
  "Email addresses",
  "Notifications",
  "Connected accounts",
  "Privacy and data",
];

export default function SettingsPage() {
  const [tab, setTab] = React.useState(TABS[0]);
  const [notif, setNotif] = React.useState({
    needs: true,
    replies: true,
    daily: false,
    coach: true,
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Your plan, your addresses and what Jobluvo is allowed to do.</p>
        </div>
      </div>

      <div className="set">
        <div className="set-nav">
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "on" : undefined} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div>
          {tab === "Plan and usage" && (
            <>
              <Card title="Current plan">
                <div className="kvrow">
                  <span className="k">Plan</span>
                  <span className="v">Max, billed annually</span>
                </div>
                <div className="kvrow">
                  <span className="k">Price</span>
                  <span className="v">USD {prices.annual.max} a year</span>
                </div>
                <div className="kvrow">
                  <span className="k">Applications left this month</span>
                  <span className="v">1,412 of 5,000</span>
                </div>
                <div className="kvrow">
                  <span className="k">Renews</span>
                  <span className="v">4 March 2027</span>
                </div>
                <div className="progress">
                  <i style={{ width: `${((5000 - 1412) / 5000) * 100}%` }} />
                </div>
              </Card>

              <div style={{ marginTop: 12 }}>
                <SourcesCard />
              </div>

              <div style={{ marginTop: 12 }}>
                <Card title="Plans">
                  <div className="kvlist">
                    {plans.map((p) => (
                      <div className="kvrow" key={p.key}>
                        <span className="k" style={{ width: "auto" }}>
                          <b style={{ color: "var(--fg)", fontWeight: 500 }}>{p.name}</b>
                          <div className="sub">{p.description}</div>
                        </span>
                        <span className="v">
                          ${prices.monthly[p.key]} a month
                          {p.key === "max" && (
                            <div className="sub" style={{ fontWeight: 400 }}>
                              Your plan
                            </div>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    style={{ marginTop: 12 }}
                    onClick={() => showToast({ text: "Change plan. This is a mock." })}
                  >
                    Change plan
                  </Button>
                </Card>
              </div>
            </>
          )}

          {tab === "Account" && (
            <Card title="Account">
              <div className="kvrow">
                <span className="k">Name</span>
                <span className="v">Jack Miller</span>
              </div>
              <div className="kvrow">
                <span className="k">Sign in email</span>
                <span className="v">jack.miller@gmail.com</span>
              </div>
              <div className="kvrow">
                <span className="k">Password</span>
                <span className="v">Last changed 11 Aug</span>
              </div>
              <div className="kvrow">
                <span className="k">Time zone</span>
                <span className="v">Europe/Istanbul</span>
              </div>
            </Card>
          )}

          {tab === "Email addresses" && (
            <Card title="Email addresses">
              <div className="kvrow">
                <span className="k">Jobluvo address</span>
                <span className="v">
                  jack.miller@jobluvo.com <span className="tag strong">Active</span>
                </span>
              </div>
              <div className="kvrow">
                <span className="k">Forwards a copy to</span>
                <span className="v">jack.miller@gmail.com</span>
              </div>
              <div className="kvrow">
                <span className="k">Used for employer accounts</span>
                <span className="v">Yes</span>
              </div>
              <p className="sub" style={{ marginTop: 12 }}>
                The address stays yours. It is never handed to another person, even if you
                cancel. You can switch to your own email instead.
              </p>
              <Button
                size="sm"
                style={{ marginTop: 12 }}
                onClick={() => showToast({ text: "Use my own email. This is a mock." })}
              >
                Use my own email instead
              </Button>
            </Card>
          )}

          {tab === "Notifications" && (
            <Card title="Notifications">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Toggle
                  on={notif.needs}
                  onChange={(v) => setNotif({ ...notif, needs: v })}
                  label="An application needs you"
                  description="Sent as soon as a form asks something your profile cannot answer."
                />
                <Toggle
                  on={notif.replies}
                  onChange={(v) => setNotif({ ...notif, replies: v })}
                  label="Employer replies"
                  description="Interview invites, assessments and recruiter questions."
                />
                <Toggle
                  on={notif.daily}
                  onChange={(v) => setNotif({ ...notif, daily: v })}
                  label="Daily summary"
                  description="One message a day with what your lanes sent."
                />
                <Toggle
                  on={notif.coach}
                  onChange={(v) => setNotif({ ...notif, coach: v })}
                  label="Coach nudges"
                  description="Daniel checks in once a quarter with the plan."
                />
              </div>
            </Card>
          )}

          {tab === "Connected accounts" && (
            <Card title="Connected accounts">
              <div className="kvrow">
                <span className="k">Google</span>
                <span className="v">Connected for sign in</span>
              </div>
              <div className="kvrow">
                <span className="k">Gmail</span>
                <span className="v" style={{ color: "var(--fg-subtle)", fontWeight: 400 }}>
                  Not connected
                </span>
              </div>
              <p className="sub" style={{ marginTop: 12 }}>
                Messages sent to your own Gmail stay there and are not shown in the Jobluvo
                inbox unless you connect it.
              </p>
            </Card>
          )}

          {tab === "Privacy and data" && (
            <Card title="Privacy and data">
              <p className="sub" style={{ margin: "0 0 12px" }}>
                Resumes are built only from facts you confirmed. Nothing is invented. You can
                pause everything or export your data at any time.
              </p>
              <div className="row">
                <Button onClick={() => showToast({ text: "Export started. This is a mock." })}>
                  Export my data
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => showToast({ text: "Pause everything. This is a mock." })}
                >
                  Pause everything
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
