"use client";

import * as React from "react";
import Link from "next/link";
import { cats, posts } from "@/lib/marketing/posts";

export function BlogIndex() {
  const [cat, setCat] = React.useState("All");

  const featured = posts.find((p) => p.featured) ?? posts[0];
  const list = posts.filter(
    (p) => p.id !== featured.id && (cat === "All" || p.cat === cat),
  );

  return (
    <>
      <Link href={`/blog/${featured.id}`} className="bfeat">
        <div className="bmeta">
          <span>{featured.date}</span>
        </div>
        <h2>{featured.title}</h2>
        <p>{featured.excerpt}</p>
        <span className="rm">Read the full breakdown</span>
      </Link>

      <div className="bcats">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            className={c === cat ? "on" : undefined}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div>
        {list.map((p) => (
          <Link href={`/blog/${p.id}`} className="brow" key={p.id}>
            <div className="bmeta">
              <span>{p.date}</span>
            </div>
            <h3>{p.title}</h3>
            <p>{p.excerpt}</p>
            <span className="rm">Read more</span>
          </Link>
        ))}
        {list.length === 0 && (
          <p className="muted small" style={{ paddingTop: 24 }}>
            Nothing in this category yet.
          </p>
        )}
      </div>
    </>
  );
}
