// components/ClientNav.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";
import ClientLogoutButton from "../app/(auth)/logout/page";
import { usePathname } from "next/navigation";

type Props = {
  loggedIn: boolean;
};

export default function ClientNav({ loggedIn }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname?.startsWith("/login?") ||
    pathname?.startsWith("/register?");

  return (
    <>
      {/* Desktop nav */}
      <div className="hidden sm:flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-slate-800 dark:text-slate-300"
        >
          Dashboard
        </Link>

        {loggedIn && (
          <Link
            href="/statistic"
            className="text-slate-800 dark:text-slate-300"
          >
            Statistic
          </Link>
        )}

        <ThemeToggle />

        {loggedIn && !isAuthRoute ? (
          <ClientLogoutButton />
        ) : (
          <>
            <Link
              href="/login"
              className="px-3 py-1 rounded text-slate-800 dark:text-slate-300"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-3 py-1 rounded bg-amber-500 text-white"
            >
              Sign up
            </Link>
          </>
        )}
      </div>

      {/* Mobile burger */}
      <div className="sm:hidden flex items-center gap-2">
        <ThemeToggle />
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
          className="p-2 rounded-md border border-slate-200 dark:border-slate-700"
        >
          {open ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-slate-800 dark:text-slate-200"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-slate-800 dark:text-slate-200"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3 5h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile slide-over menu */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <nav className="absolute right-0 top-0 w-3/4 max-w-xs h-full bg-white dark:bg-slate-900 shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setOpen(false)} className="p-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-slate-800 dark:text-slate-200"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <ul className="space-y-4">
              <li>
                <Link
                  href="/dashboard"
                  className="block text-lg font-medium text-slate-800 dark:text-slate-200"
                >
                  Dashboard
                </Link>
              </li>

              {loggedIn && (
                <li>
                  <Link
                    href="/statistic"
                    className="block text-lg font-medium text-slate-800 dark:text-slate-200"
                  >
                    Statistic
                  </Link>
                </li>
              )}

              {loggedIn && !isAuthRoute ? (
                <li>
                  <ClientLogoutButton />
                </li>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className="block text-lg font-medium text-slate-800 dark:text-slate-200"
                    >
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/register"
                      className="block text-lg font-medium bg-amber-500 text-white px-4 py-2 rounded"
                    >
                      Create account
                    </Link>
                  </li>
                </>
              )}

              <li className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Theme
                </div>
                <div className="mt-2">
                  <ThemeToggle />
                </div>
              </li>
            </ul>

            <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} CleanNote
            </div>
          </nav>
        </div>
      )}
    </>
  );
}