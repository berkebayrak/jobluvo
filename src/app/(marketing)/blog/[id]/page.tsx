import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Band } from "@/components/marketing/Band";
import { posts } from "@/lib/marketing/posts";

export function generateStaticParams() {
  return posts.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = posts.find((p) => p.id === id);
  if (!post) return { title: "Not found. Jobluvo" };
  return { title: `${post.title}. Jobluvo`, description: post.excerpt };
}

export default async function PostPage({ params }: PageProps<"/blog/[id]">) {
  const { id } = await params;
  const post = posts.find((p) => p.id === id);
  if (!post) notFound();

  const more = posts.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <main>
      <section className="m-section tight">
        <div className="wrap">
          <article className="article">
            <Link href="/blog" className="back">
              All posts
            </Link>
            <div className="bmeta">
              <span>{post.date}</span>
            </div>
            <h1 className="display">{post.title}</h1>
            <p className="lead" style={{ maxWidth: "none" }}>
              {post.excerpt}
            </p>
            {/* Body is prebuilt HTML from the handoff, not user input. */}
            <div dangerouslySetInnerHTML={{ __html: post.body }} />

            <hr
              style={{
                border: 0,
                borderTop: "1px solid var(--border)",
                margin: "36px 0 18px",
              }}
            />
            <div className="bmeta">
              Written by the Jobluvo team. Questions or corrections: hello@jobluvo.com
            </div>

            <h2 style={{ fontSize: "var(--text-xl)" }}>More from the blog</h2>
            {more.map((q) => (
              <Link href={`/blog/${q.id}`} className="brow" key={q.id}>
                <div className="bmeta">
                  <span>{q.date}</span>
                </div>
                <h3>{q.title}</h3>
                <span className="rm">Read more</span>
              </Link>
            ))}
          </article>
        </div>
      </section>

      <Band
        title="Try the thing we keep writing about."
        body="25 applications free, no card, a coach from day one."
        action="Start free"
      />
    </main>
  );
}
