import type { Metadata } from "next";
import { SignInForm } from "@/components/marketing/AuthForm";

export const metadata: Metadata = { title: "Sign in. Jobluvo" };

export default function SignInPage() {
  return (
    <main>
      <SignInForm />
    </main>
  );
}
