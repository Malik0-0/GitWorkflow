"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ClientLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Logout failed");
        return;
      }
      toast.success("Logged out");
      localStorage.setItem("cleannote_session_updated", Date.now().toString());
      router.replace("/login");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Logout failed");
    }
  }

  return (
    <button onClick={handleLogout} className="px-3 py-1 rounded btn-danger">Logout</button>
  );
}