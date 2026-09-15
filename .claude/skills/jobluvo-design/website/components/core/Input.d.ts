/** Text input with label, hint and error. 36px tall. */
export interface InputProps {
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
export function Input(props: InputProps): JSX.Element;
