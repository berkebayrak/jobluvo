/** One line banner for things that need the user. Black border, no fill. */
export interface BannerProps {
  title: string;
  body?: string;
  /** Usually a primary sm Button */
  primary?: React.ReactNode;
  /** Usually a secondary sm Button labelled Later */
  secondary?: React.ReactNode;
  /** attention draws a black border, info a grey one */
  tone?: "attention" | "info";
}
export function Banner(props: BannerProps): JSX.Element;
