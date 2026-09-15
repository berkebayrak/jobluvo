import type { Metadata } from "next";
import { Band } from "@/components/marketing/Band";
import { FaqList } from "@/components/marketing/FaqList";
import { faqs } from "@/lib/marketing/faqs";

export const metadata: Metadata = {
  title: "FAQ. Jobluvo",
  description: "Questions people ask before they sign up.",
};

export default function FaqPage() {
  return (
    <main>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <div className="wrap" style={{ display: "block" }}>
          <h1
            className="display"
            style={{ fontSize: "var(--text-4xl)", lineHeight: "var(--leading-4xl)" }}
          >
            Questions people ask before they sign up.
          </h1>
        </div>
      </section>

      <section className="m-section tight">
        <div className="wrap faqwrap">
          <h2 className="big">FAQs</h2>
          <div className="faqbox">
            <FaqList items={faqs} />
          </div>
        </div>
      </section>

      <Band
        title="Still wondering? Ask Maya."
        body="She answers inside the product, with your real data. The first 25 applications are free."
        action="Start free"
      />
    </main>
  );
}
