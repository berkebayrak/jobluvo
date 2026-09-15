"use client";

import * as React from "react";

export interface ToastProps {
  text: string;
  /** Usually "Undo" */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * The pill itself, without placement. Shared by the fixed Toast below and by
 * the sonner-driven showToast in Toaster.tsx so both render identical chrome.
 */
export function ToastPill({ text, actionLabel, onAction }: ToastProps) {
  return (
    <div
      style={{
        background: "var(--surface-inverse)",
        color: "var(--fg-inverse)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px 10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: "var(--text-sm)",
        lineHeight: "var(--leading-sm)",
        fontFamily: "var(--font-sans)",
        whiteSpace: "nowrap",
      }}
    >
      <span>{text}</span>
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            border: 0,
            background: "transparent",
            color: "var(--jl-grey-400)",
            fontSize: "var(--text-xs)",
            padding: "0 4px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Black pill at the bottom centre, the only inverted surface besides primary
 * buttons. Dismiss after 3 seconds. Never stack more than one.
 *
 * Renders itself where it stands. For queueing and auto dismiss use showToast
 * from Toaster.tsx instead.
 */
export function Toast({ text, actionLabel, onAction }: ToastProps) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 60,
      }}
    >
      <ToastPill text={text} actionLabel={actionLabel} onAction={onAction} />
    </div>
  );
}
