import * as React from "react";

export interface ChatBubbleProps {
  /** user bubbles are filled grey on the right, agent bubbles outlined on the left */
  from: "user" | "agent";
  children: React.ReactNode;
}

/**
 * Agent panel message. No avatars in the thread: the active agent is named in
 * the panel header, not per bubble.
 */
export function ChatBubble({ from = "agent", children }: ChatBubbleProps) {
  const me = from === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: me ? "flex-end" : "flex-start",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          maxWidth: "86%",
          padding: "8px 12px",
          borderRadius: "var(--radius-md)",
          fontSize: "var(--text-sm)",
          lineHeight: "19px",
          background: me ? "var(--surface-2)" : "var(--surface-0)",
          border: `1px solid ${me ? "var(--surface-2)" : "var(--border)"}`,
          color: "var(--fg)",
          textWrap: "pretty",
        }}
      >
        {children}
      </div>
    </div>
  );
}
