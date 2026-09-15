/** 400x440 swipe card with match ring and APPLY / SKIP stamps. */
export interface SwipeCardProps {
  company: string;
  logo?: string;
  title: string;
  location: string;
  posted?: string;
  salary?: string;
  ats?: string;
  match: number;
  reasons?: string[];
  /** Small print at the bottom, e.g. which resume will be tailored */
  footnote?: string;
  /** Animates the card off screen and shows the stamp */
  stamp?: "apply" | "skip" | null;
  style?: React.CSSProperties;
}
export function SwipeCard(props: SwipeCardProps): JSX.Element;
