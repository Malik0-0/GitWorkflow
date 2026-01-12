"use client";

import { useState } from "react";
import AuthForm from "@/components/AuthForm";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: any) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "Login failed");
        toast.error(data?.error || "Login failed");
      } else {
        toast.success("Welcome back!");
        localStorage.setItem("cleannote_session_updated", Date.now().toString());
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setErr(err.message || "Network error");
      toast.error(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return <AuthForm title="Welcome back" buttonText="Login" onSubmit={onSubmit} error={err} loading={loading} />;
}