import Link from "next/link";
// test add comment
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* HERO */}
      <section className="px-4 py-12 md:py-20 bg-gradient-to-b from-amber-50 to-white dark:from-slate-900 dark:to-slate-950">
        <div className="container mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-slate-800 dark:text-slate-100">
              CleanNote — calm reflection, clearer thinking.
            </h1>

            <p className="text-slate-700 dark:text-slate-300 max-w-xl">
              Capture short thoughts, polish them with one-click AI, and gain weekly insights.
              Designed for emotional clarity and gentle habit building.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-3">
              <Link
                href="/register"
                className="btn-primary w-full sm:w-auto text-center"
                aria-label="Get started"
              >
                Get started, it's free!!!
              </Link>
              <Link
                href="/login"
                className="mt-0 sm:mt-0 inline-flex items-center justify-center px-4 py-2 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300 w-full sm:w-auto shrink-0"
              >
                Sign in
              </Link>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400 mt-4">
              AI is opt-in • Weekly summaries are limited to once per 7 days • Your entries remain private.
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            {/* phone mock */}
            <div className="rounded-2xl overflow-hidden shadow-2xl" aria-hidden>
              <div className="p-5 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Morning • 7:12 AM</div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Short reflection</div>
                  </div>
                  <div className="text-xs text-amber-600 dark:text-emerald-300">Mood: Calm</div>
                </div>

                <div className="mt-4 text-slate-700 dark:text-slate-200">
                  Today I took a long walk and the noise felt quieter. I noticed small wins and felt lighter.
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="px-3 py-1 rounded bg-amber-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm">Edit</button>
                  <button className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm">Tidy up</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-12">
        <div className="container mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-100">Designed to help you</h2>
          <p className="text-slate-600 dark:text-slate-400 text-center mt-2 max-w-2xl mx-auto">
            Short, focused entries — AI when you want it — insights that respect your time.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Feature title="Quick capture" desc="Write short entries quickly. Keep momentum, not complexity." icon="✍️" />
            <Feature title="Tidy up" desc="One-click rewrite & mood detection to make entries readable." icon="🧹" />
            <Feature title="Mood calendar" desc="Visualize moods and spot trends over time." icon="📅" />
            <Feature title="Weekly insights" desc="Concise weekly summary to reflect and plan." icon="🔎" />
          </div>
        </div>
      </section>

      {/* PROMO */}
      <section className="py-12 bg-amber-50 dark:bg-slate-900">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Privacy-first</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-lg">
              AI calls happen only when you request them. Your entries live in your database on Supabase.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="card p-4 text-center">
              <div className="text-sm text-slate-500 dark:text-slate-400">Built with</div>
              <div className="font-medium mt-1 text-slate-800 dark:text-slate-100">Next.js • Prisma • Supabase</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-sm text-slate-500 dark:text-slate-400">AI</div>
              <div className="font-medium mt-1 text-slate-800 dark:text-slate-100">Hugging Face & Gemini</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-12">
        <div className="container mx-auto">
          <h3 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-100">Loved by early users</h3>
          <div className="mt-6 grid md:grid-cols-3 gap-6">
            <Quote text="A small ritual that helps me start the day with clarity." who="Anna • Designer" />
            <Quote text="Tidy up makes my notes readable again — such a time saver." who="Jason • Student" />
            <Quote text="Simple, calming, and it just works." who="Rita • Researcher" />
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">CleanNote</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Calm journaling, thoughtfully designed.</div>
          </div>
          <div className="flex gap-3">
            <Link href="/register" className="btn-primary">Create account</Link>
            <Link href="/login" className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-slate-800 flex items-center justify-center text-xl">{icon}</div>
        <div>
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function Quote({ text, who }: { text: string; who: string }) {
  return (
    <div className="card p-6">
      <div className="text-slate-700 dark:text-slate-200">“{text}”</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mt-3">{who}</div>
    </div>
  );
}