/** @startingPoint section="Jobs" subtitle="List view card with match reasons and Apply, Save, Skip" viewport="360x300" */
export interface JobCardProps {
  company: string;
  logo?: string;
  title: string;
  location: string;
  salary?: string;
  /** Application system, e.g. Greenhouse */
  ats?: string;
  posted?: string;
  match: number;
  /** Prefix with "-" for a reason against. Others read as for. */
  reasons?: string[];
  onApply?: () => void;
  onSave?: () => void;
  onSkip?: () => void;
}
export function JobCard(props: JobCardProps): JSX.Element;
