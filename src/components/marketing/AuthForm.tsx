"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/core/Button";
import { showToast } from "@/components/feedback/Toaster";
import { HeroDemo } from "@/components/marketing/HeroDemo";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.2 0 11.6-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/** Turns "Jack Miller" into jack.miller@jobluvo.com, as the delivered site did. */
export function addrFrom(n: string): string {
  const p = n
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return p.length ? `${p.join(".")}@jobluvo.com` : "";
}

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("jack.miller@gmail.com");
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState(false);

  function submit() {
    const ok = email.trim() && pass;
    setErr(!ok);
    if (ok) {
      // Placeholder until real auth exists: nothing is checked, any filled in
      // form opens the product.
      showToast({ text: "Signing you in." });
      router.push("/dashboard");
    }
  }

  return (
    <div className="wrap auth">
      <div className="form">
        <h1 className="display">Welcome back.</h1>
        <p className="lead">Your lanes kept running. Let us see what came in.</p>
        <div className="box">
          <Button
            style={{ width: "100%", fontSize: 15 }}
            onClick={() => {
              showToast({ text: "Google sign in would open here. Continuing to the dashboard." });
              router.push("/dashboard");
            }}
          >
            <GoogleMark />
            Continue with Google
          </Button>
          <div className="or">OR</div>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {err && <div className="err">Enter your email and password.</div>}
          <Button variant="primary" style={{ width: "100%", fontSize: 15 }} onClick={submit}>
            Continue
          </Button>
          <div className="fine">
            By continuing, you acknowledge Jobluvo&apos;s <a href="#">Privacy Policy</a>.
          </div>
        </div>
        <div className="switch">
          New here? <Link href="/signup">Create an account</Link>
        </div>
      </div>
      <HeroDemo withFeed={false} />
    </div>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState(false);
  const addr = addrFrom(name);

  function submit() {
    const ok = name.trim() && email.trim() && pass;
    setErr(!ok);
    if (ok) {
      // Placeholder until real auth exists: no account is created.
      showToast({ text: `Account created. Your address is ${addr}.` });
      router.push("/dashboard");
    }
  }

  return (
    <div className="wrap auth">
      <div className="form">
        <h1 className="display">Start your search.</h1>
        <p className="lead">25 applications free. No card needed.</p>
        <div className="box">
          <Button
            style={{ width: "100%", fontSize: 15 }}
            onClick={() => {
              showToast({ text: "Google sign in would open here. Continuing to the dashboard." });
              router.push("/dashboard");
            }}
          >
            <GoogleMark />
            Continue with Google
          </Button>
          <div className="or">OR</div>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {addr && (
            <div className="addr-preview">
              Your Jobluvo address will be <code>{addr}</code>
            </div>
          )}
          <input
            type="password"
            placeholder="Create a password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {err && <div className="err">Fill in your name, email and a password.</div>}
          <Button variant="primary" style={{ width: "100%", fontSize: 15 }} onClick={submit}>
            Create account
          </Button>
          <div className="fine">
            By continuing, you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
            .
          </div>
        </div>
        <div className="switch">
          Already have an account? <Link href="/signin">Sign in</Link>
        </div>
      </div>
      <HeroDemo withFeed={false} />
    </div>
  );
}
