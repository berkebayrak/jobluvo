import type { Metadata } from "next";
import { SignUpForm } from "@/components/marketing/AuthForm";

export const metadata: Metadata = { title: "Start free. Jobluvo" };

export default function SignUpPage() {
  return (
    <main>
      <SignUpForm />
    </main>
  );
}
