"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();

    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden bg-[var(--workspace)] px-4">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-xl font-bold tracking-tight text-[var(--charcoal-900)] sm:text-2xl">
          BuildOps
        </h1>

        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--charcoal-500)]">
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--emerald-200)] border-t-[var(--emerald-600)]"
          />
          <span>Redirecting...</span>
        </div>
      </div>
    </main>
  );
}