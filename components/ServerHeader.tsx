import Link from "next/link";
import ClientNav from "@/components/ClientNav";
import { getSessionToken } from "@/lib/auth";

export default async function ServerHeader() {
  const token = await getSessionToken();
  const loggedIn = Boolean(token);

  return (
    <header className="w-full border-b border-slate-200 dark:border-slate-800">
      <div className="container mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-500 text-white flex items-center justify-center font-bold">CN</div>
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">CleanNote</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Tidy journaling</div>
            </div>
          </Link>
        </div>
        <ClientNav loggedIn={loggedIn} />
      </div>
    </header>
  );
}