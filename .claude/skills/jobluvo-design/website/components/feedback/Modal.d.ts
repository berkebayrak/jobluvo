/** 440px dialog. Header, body, footer with Cancel and one primary action. 32% black scrim. */
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
export function Modal(props: ModalProps): JSX.Element;
