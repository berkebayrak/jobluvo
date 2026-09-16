import { AppShell } from "@/components/app/AppShell";
import "./app.css";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
