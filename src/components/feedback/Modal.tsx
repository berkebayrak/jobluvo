"use client";

import * as React from "react";
import { Dialog } from "radix-ui";

export interface ModalProps {
  open?: boolean;
  title: string;
  children?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  /** Override the footer buttons */
  confirm?: React.ReactNode;
  cancel?: React.ReactNode;
}

function footerButton(primary: boolean, label: string, onClick?: () => void) {
  return (
    <button
      onClick={onClick}
      style={{
        height: "var(--control-md)",
        padding: "0 12px",
        border: `1px solid ${primary ? "var(--accent)" : "var(--border-strong)"}`,
        borderRadius: "var(--radius-sm)",
        background: primary ? "var(--accent)" : "var(--surface-0)",
        color: primary ? "var(--fg-inverse)" : "var(--fg)",
        fontWeight: 500,
        fontFamily: "inherit",
        fontSize: "var(--text-sm)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

/**
 * 440px dialog. Header, body, footer with Cancel and one primary action.
 * Use for confirmations and single questions only. Anything longer is a screen.
 *
 * Built on Radix Dialog for the behaviour only, focus trap, Esc to close,
 * scroll lock and the aria wiring. Every visual value comes from the tokens.
 */
export function Modal({
  open = true,
  title,
  children,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  confirm,
  cancel,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel?.();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,18,20,.32)",
            zIndex: 50,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 440,
            maxWidth: "calc(100% - 48px)",
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            zIndex: 50,
            fontFamily: "var(--font-sans)",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "var(--text-md)",
              fontWeight: 500,
            }}
          >
            <Dialog.Title style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit" }}>
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                border: 0,
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--fg-subtle)",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </Dialog.Close>
          </div>

          <div
            style={{
              padding: 20,
              color: "var(--fg-muted)",
              fontSize: "var(--text-base)",
              lineHeight: "21px",
              textWrap: "pretty",
            }}
          >
            {children}
          </div>

          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            {cancel || footerButton(false, cancelLabel, onCancel)}
            {confirm || footerButton(true, confirmLabel, onConfirm)}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
