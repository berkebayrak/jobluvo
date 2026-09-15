import type { Metadata } from "next";
import { geistSans } from "./fonts";
import { Toaster } from "@/components/feedback/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobluvo",
  description:
    "Jobluvo finds matching jobs, tailors your resume for each one and tracks every employer reply.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
