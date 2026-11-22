"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";

type RegisterResponse = {
  detail: string;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  organization: {
    id: number;
    name: string;
    slug: string;
    role: string;
  };
};

const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

export default function RegisterPage() {
  const router = useRouter();
  const redirectTimerRef = useRef<number | null>(null);

  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    business_phone: "",
    business_email: "",
    address: "",
    city: "",
    country: "Kenya",
    currency: "KES",
    timezone: "Africa/Nairobi",

    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch<RegisterResponse>(
        "/api/accounts/register/",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            business_name: form.business_name.trim(),
            business_type: form.business_type.trim(),
            business_phone: form.business_phone.trim(),
            business_email: form.business_email.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            country: form.country.trim(),
            currency: form.currency.trim(),
            timezone: form.timezone.trim(),
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
          }),
        },
      );

      setSuccess(
        `${data.detail} Your business "${data.organization.name}" is ready.`,
      );

      redirectTimerRef.current = window.setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-[var(--workspace)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl min-w-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--emerald-700)]">
            BuildOps
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--charcoal-900)] sm:text-3xl">
            Create your BuildOps account
          </h1>
          <p className="mt-1.5 text-sm text-[var(--charcoal-500)]">
            Set up your business and create the first administrator account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 min-w-0 space-y-6 sm:mt-8">
          {/* Business Information */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--charcoal-900)] sm:text-xl">
              Business Information
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Tell us about the business you want to manage with BuildOps.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <label htmlFor="business_name" className={labelClass}>
                  Business Name
                </label>
                <input
                  id="business_name"
                  name="business_name"
                  type="text"
                  value={form.business_name}
                  onChange={handleChange}
                  placeholder="e.g. Juja Builders Hardware"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="business_type" className={labelClass}>
                  Business Type
                </label>
                <input
                  id="business_type"
                  name="business_type"
                  type="text"
                  placeholder="e.g. Hardware and Building Materials"
                  value={form.business_type}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="business_phone" className={labelClass}>
                  Business Phone
                </label>
                <input
                  id="business_phone"
                  name="business_phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.business_phone}
                  onChange={handleChange}
                  placeholder="e.g. 0712345678"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="business_email" className={labelClass}>
                  Business Email
                </label>
                <input
                  id="business_email"
                  name="business_email"
                  type="email"
                  autoComplete="email"
                  value={form.business_email}
                  onChange={handleChange}
                  placeholder="business@example.com"
                  className={inputClass}
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="city" className={labelClass}>
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Nairobi"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0 sm:col-span-2">
                <label htmlFor="address" className={labelClass}>
                  Address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Street, building, or landmark"
                  className={inputClass}
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="country" className={labelClass}>
                  Country
                </label>
                <input
                  id="country"
                  name="country"
                  type="text"
                  autoComplete="country-name"
                  value={form.country}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="currency" className={labelClass}>
                  Currency
                </label>
                <input
                  id="currency"
                  name="currency"
                  type="text"
                  value={form.currency}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0 sm:col-span-2">
                <label htmlFor="timezone" className={labelClass}>
                  Timezone
                </label>
                <input
                  id="timezone"
                  name="timezone"
                  type="text"
                  value={form.timezone}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </section>

          {/* Administrator Information */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--charcoal-900)] sm:text-xl">
              Administrator Account
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              This will be the first administrator for your BuildOps
              organization.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="first_name" className={labelClass}>
                  First Name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="First name"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="last_name" className={labelClass}>
                  Last Name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Last name"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="username" className={labelClass}>
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="admin@example.com"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0 sm:col-span-2">
                <label htmlFor="phone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. 0712345678"
                  className={inputClass}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  className={inputClass}
                  minLength={8}
                  required
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="confirm_password" className={labelClass}>
                  Confirm Password
                </label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  className={inputClass}
                  minLength={8}
                  required
                />
              </div>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="break-words rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#293D2D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243428] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create BuildOps Account"}
          </button>

          <p className="text-center text-sm text-[var(--charcoal-500)]">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="font-semibold text-[var(--charcoal-900)] underline hover:text-[var(--emerald-700)]"
            >
              Login
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}