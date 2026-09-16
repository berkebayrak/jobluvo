import type { Metadata } from "next";
import { BlogIndex } from "@/components/marketing/BlogIndex";

export const metadata: Metadata = {
  title: "Job search and career blog. Jobluvo",
  description:
    "Honest comparisons of the auto apply tools, and what we have learned about finding work.",
};

export default function BlogPage() {
  return (
    <main>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <div className="wrap" style={{ display: "block" }}>
          <div>
            <h1
              className="display"
              style={{ fontSize: "var(--text-4xl)", lineHeight: "var(--leading-4xl)" }}
            >
              Job search and career blog
            </h1>
            <p className="lead" style={{ maxWidth: "none" }}>
              Honest comparisons of the auto apply tools, and what we have learned about
              finding work from the people using Jobluvo.
            </p>
          </div>
        </div>
      </section>

      <section className="m-section tight" style={{ paddingTop: 28 }}>
        <div className="wrap blogwrap">
          <BlogIndex />
        </div>
      </section>
    </main>
  );
}
