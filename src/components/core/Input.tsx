"use client";

import * as React from "react";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "style"> {
  label?: string;
  hint?: string;
  /** Replaces the hint and turns the border muted red */
  error?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  style?: React.CSSProperties;
}

/** Single line text field, 36px. Error is the only red in the system. */
export function Input({
  label,
  hint,
  error,
  disabled,
  readOnly,
  style,
  ...rest
}: InputProps) {
  const [focus, setFocus] = React.useState(false);
  const border = error
    ? "var(--danger)"
    : focus
      ? "var(--border-focus)"
      : "var(--border-strong)";

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
      <input
        disabled={disabled}
        readOnly={readOnly}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...rest}
        style={{
          height: "var(--control-md)",
          padding: "0 10px",
          border: `1px solid ${disabled || readOnly ? "var(--border)" : border}`,
          borderRadius: "var(--radius-sm)",
          background:
            disabled || readOnly ? "var(--surface-1)" : "var(--surface-0)",
          color: disabled
            ? "var(--fg-disabled)"
            : readOnly
              ? "var(--fg-subtle)"
              : "var(--fg)",
          fontSize: "var(--text-sm)",
          fontFamily: "inherit",
          outline: 0,
        }}
      />
      {(hint || error) && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            lineHeight: "var(--leading-xs)",
            color: error ? "var(--danger)" : "var(--fg-subtle)",
          }}
        >
          {error || hint}
        </span>
      )}
    </label>
  );
}
