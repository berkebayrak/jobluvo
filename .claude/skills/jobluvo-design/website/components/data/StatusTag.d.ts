/** @startingPoint section="Data" subtitle="Eleven application states, read by glyph and border weight, never colour" viewport="700x160" */
export interface StatusTagProps {
  status: "submitted" | "needs" | "held" | "verifying" | "failed" | "applied" | "replied" | "interviewing" | "offer" | "rejected" | "ghosted";
  size?: "sm" | "md";
}
export function StatusTag(props: StatusTagProps): JSX.Element;
