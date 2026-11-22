"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { fetchPermissions, getDefaultRoute } from "@/lib/permissions";

type LoginResponse = {
  token: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const data = await apiFetch<LoginResponse>("/api-token-auth/", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      setToken(data.token);

      const permissions = await fetchPermissions(data.token);

      router.push(getDefaultRoute(permissions));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden bg-[var(--workspace)] px-4 py-8 sm:px-6">
      <div className="w-full max-w-md min-w-0 rounded-xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--emerald-700)]">
            BuildOps
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--charcoal-900)]">
            Sign in to your account
          </h1>
          <p className="mt-1.5 text-sm text-[var(--charcoal-500)]">
            Enter your credentials to access your workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
          <div className="min-w-0">
            <label
              htmlFor="username"
              className="mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]"
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:text-sm"
              required
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:text-sm"
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#293D2D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243428] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}