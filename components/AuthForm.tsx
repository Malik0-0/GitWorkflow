"use client";
import React from "react";

type Props = {
  title: string;
  buttonText: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error?: string | null;
  loading?: boolean;
};

export default function AuthForm({ title, buttonText, onSubmit, error, loading }: Props) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md card space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        {error && <div className="text-red-400">{error}</div>}

        <div>
          <label className="block text-sm text-slate-700 dark:text-slate-400 mb-1">Email</label>
          <input name="email" className="input" placeholder="you@domain.com" />
        </div>

        <div>
          <label className="block text-sm text-slate-700 dark:text-slate-400 mb-1">Password</label>
          <input name="password" type="password" className="input" placeholder="••••••••" />
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Password must be at least 8 characters and include both letters and numbers.
          </div>
        </div>

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Please wait..." : buttonText}
        </button>

        <div className="text-sm text-slate-600 dark:text-slate-400">
          By continuing you agree to CleanNote terms.
        </div>
      </form>
    </div>
  );
}