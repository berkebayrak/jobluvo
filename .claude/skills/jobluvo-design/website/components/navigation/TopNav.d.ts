/** 52px product header: wordmark, underline tabs, right cluster. */
export interface TopNavProps {
  tabs: string[];
  active: string;
  onSelect?: (tab: string) => void;
  /** Right cluster: density toggle, usage text, avatar */
  right?: React.ReactNode;
}
export function TopNav(props: TopNavProps): JSX.Element;
