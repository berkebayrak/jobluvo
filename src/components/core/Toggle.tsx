"use client";

import * as React from "react";

export interface ToggleProps {
  on: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  /** Renders a labelled row with the switch on the right */
  label?: string;
  description?: string;
}

/** 28x16 switch. Black when on, outlined when off. Only the knob animates. */
export function Toggle({
  on = false,
  onChange,
  disabled = false,
  label,
  description,
}: ToggleProps) {
  const knobBg = disabled
    ? "var(--jl-grey-200)"
    : on
      ? "var(--fg-inverse)"
      : "var(--border-strong)";

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange && onChange(!on)}
      style={{
        width: 28,
        height: 16,
        borderRadius: "var(--radius-full)",
        border: `1px solid ${
          disabled
            ? "var(--border)"
            : on
              ? "var(--accent)"
              : "var(--border-strong)"
        }`,
        background: disabled
          ? "var(--surface-1)"
          : on
            ? "var(--accent)"
            : "var(--surface-0)",
        position: "relative",
        padding: 0,
        flex: "none",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 13 : 2,
          width: 10,
          height: 10,
          borderRadius: "var(--radius-full)",
          background: knobBg,
          transition: "left var(--duration-fast) var(--ease)",
        }}
      />
    </button>
  );

  if (!label) return track;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        fontFamily: "var(--font-sans)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div>
        <div
          style={{
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-sm)",
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              lineHeight: "var(--leading-xs)",
              color: "var(--fg-subtle)",
            }}
          >
            {description}
          </div>
        )}
      </div>
      {track}
    </div>
  );
}
