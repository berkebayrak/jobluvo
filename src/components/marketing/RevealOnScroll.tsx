"use client";

import * as React from "react";

/**
 * Scroll reveal, as the delivered site does it: every `.reveal` element gets
 * `in` once 12% of it is in view, and is then left alone.
 *
 * The marketing pages share this layout, so the component lives for the whole
 * visit. New `.reveal` elements arrive with each client side navigation, and
 * on a streamed route they arrive after the pathname has already changed, so
 * the DOM is watched for additions rather than the route. Renders nothing.
 */
export function RevealOnScroll() {
  React.useEffect(() => {
    const seen = new WeakSet<Element>();

    if (!("IntersectionObserver" in window)) {
      const showAll = () =>
        document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      showAll();
      const mo = new MutationObserver(showAll);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    const observeNew = () => {
      document.querySelectorAll(".reveal:not(.in)").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };

    observeNew();
    const mo = new MutationObserver(observeNew);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
