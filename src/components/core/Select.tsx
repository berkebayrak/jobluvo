"use client";

import * as React from "react";

export interface SelectProps {
  label?: string;
  options: string[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/**
 * Native select with the Input chrome and a 14px chevron.
 *
 * Deliberately native rather than a Radix listbox: the handoff specifies a
 * native control, and it already gives keyboard support and the platform
 * picker on touch. Use for 4+ options; for 2 or 3 use a segmented Button group.
 */
export function Select({
  label,
  options = [],
  value,
  onChange,
  disabled,
  style,
}: SelectProps) {
  const [focus, setFocus] = React.useState(false);

  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            lineHeight: "var(--leading-xs)",
            fontWeight: 500,
            color: disabled ? "var(--fg-disabled)" : "var(--fg)",
          }}
        >
          {label}
        </span>
      )}
      <span style={{ position: "relative", display: "flex" }}>
        <select
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            width: "100%",
            height: "var(--control-md)",
            padding: "0 32px 0 10px",
            border: `1px solid ${
              disabled
                ? "var(--border)"
                : focus
                  ? "var(--border-focus)"
                  : "var(--border-strong)"
            }`,
            borderRadius: "var(--radius-sm)",
            background: disabled ? "var(--surface-1)" : "var(--surface-0)",
            color: disabled ? "var(--fg-disabled)" : "var(--fg)",
            fontSize: "var(--text-sm)",
            fontFamily: "inherit",
            outline: 0,
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--fg-subtle)"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            position: "absolute",
            right: 10,
            top: 11,
            pointerEvents: "none",
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}
