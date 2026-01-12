"use client";

import { useState } from "react";
import AuthForm from "@/components/AuthForm";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

function passwordIsValid(pw: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw);
}

export default function RegisterPage() {
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: any) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const email = e.target.email.value;
    const password = e.target.password.value;

    if (!passwordIsValid(password)) {
      setErr("Password must be at least 8 characters and include letters and numbers.");
      toast.error("Password must be at least 8 characters and include letters and numbers.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "Registration failed");
        toast.error(data?.error || "Registration failed");
      } else {
        toast.success("Account created — welcome!");
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

  return <AuthForm title="Create your account" buttonText="Sign up" onSubmit={onSubmit} error={err} loading={loading} />;
}