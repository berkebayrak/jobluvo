import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";
import "./marketing.css";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <MarketingNav />
      <RevealOnScroll />
      {children}
      <MarketingFooter />
    </>
  );
}
