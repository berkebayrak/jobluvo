import type { Metadata } from "next";
import { FaqList } from "@/components/marketing/FaqList";
import { PricingBlock } from "@/components/marketing/PricingBlock";
import { pricingFaqs } from "@/lib/marketing/faqs";
import { comparison } from "@/lib/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing. Jobluvo",
  description:
    "Start with 25 free applications. One verified submission uses one application.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="hero" style={{ paddingBottom: 20 }}>
        <div className="wrap" style={{ display: "block", textAlign: "center", maxWidth: 760 }}>
          <div className="eyebrow">Pricing</div>
          <h1
            className="display"
            style={{ fontSize: "var(--text-4xl)", lineHeight: "var(--leading-4xl)" }}
          >
            Simple plans, lots of applications.
          </h1>
          <p className="lead" style={{ maxWidth: "none", margin: "0 auto" }}>
            Start with 25 free applications. One verified submission uses one application.
            Failed or withdrawn attempts are never counted.
          </p>
        </div>
      </section>

      <section className="m-section tight">
        <div className="wrap">
          <PricingBlock />
        </div>
      </section>

      <section className="m-section tight ruled">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="display">Everything, side by side</h2>
          </div>
          <table className="cmp">
            <thead>
              <tr>
                <th />
                <th>Starter</th>
                <th>Pro</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td data-provisional={row.provisional || undefined}>{row.starter}</td>
                  <td data-provisional={row.provisional || undefined}>{row.pro}</td>
                  <td data-provisional={row.provisional || undefined}>{row.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="m-section tight">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="display">Pricing questions</h2>
          </div>
          <FaqList items={pricingFaqs} />
        </div>
      </section>
    </main>
  );
}
