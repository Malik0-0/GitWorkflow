// app/entries/[id]/page.tsx
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import EntryDetailCard from "@/components/EntryCardDetail";

async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

/**
 * Note: `params` can be a Promise in the new RSC/Turbopack environment.
 * We `await` params before accessing `id` to avoid `undefined` being passed
 * to Prisma (which produced the PrismaClientValidationError).
 */
export default async function EntryPage(props: { params: Promise<{ id: string }> } | { params: { id: string } }) {
  // Unwrap params which may be a Promise (per Next's error message).
  const resolvedParams = await (props as any).params;
  const id = resolvedParams?.id;

  // basic guard
  if (!id) {
    // If there's no id, send user back to dashboard (or show 404 page).
    return redirect("/dashboard");
  }

  const user = await getCurrentPrismaUser();
  if (!user) return redirect("/login");

  // Fetch entry (safe to pass `id` now)
  const e = await prisma.entry.findUnique({ where: { id } });

  // If not found or belongs to another user, redirect
  if (!e || e.userId !== user.id) {
    return redirect("/dashboard");
  }

  // NORMALIZE nullable DB fields into safe client values
  const entry = {
    id: e.id,
    contentRaw: e.contentRaw ?? "",
    contentTidied: e.contentTidied ?? null,
    titleRaw: e.titleRaw ?? "",
    titleTidied: e.titleTidied ?? null,
    moodLabel: e.moodLabel ?? "",
    moodScore: e.moodScore ?? null,
    category: e.category ?? "",
    // keep date fields consistent as ISO date strings where present
    dayDate: e.dayDate ? e.dayDate.toISOString() : null,
    tidiedAt: e.tidiedAt ? e.tidiedAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
    moodManual: e.moodManual ?? false,
    categoryManual: e.categoryManual ?? false,
    dateManual: e.dateManual ?? false,
  };

  return (
    <div className="py-6">
      <EntryDetailCard entry={entry} />
    </div>
  );
}