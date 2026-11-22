"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  SearchBar,
  Select,
  StatusBadge,
  Toast,
} from "@/components";
import type { Column } from "@/components";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/Pagination";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Organization = {
  id: number;
  name: string;
  slug: string;
  business_type: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  timezone: string;
  is_active: boolean;
};

type User = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Profile = {
  phone: string;
  employee_id: string | null;
  department: string;
  active_organization: number | null;
  created_at: string;
  updated_at: string;
};

type Membership = {
  id: number;
  organization: Organization;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type MeResponse = {
  user: User;
  profile: Profile;
  organizations: Membership[];
  current_organization: Organization | null;
};

type TeamMember = {
  id: number;
  user: User;
  profile: Profile;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TeamForm = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  employee_id: string;
  department: string;
  role: string;
  password: string;
  confirm_password: string;
};

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const emptyTeamForm: TeamForm = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  phone: "",
  employee_id: "",
  department: "",
  role: "sales",
  password: "",
  confirm_password: "",
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
  inventory: "Inventory",
};

const teamRoles = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales" },
  { value: "inventory", label: "Inventory" },
];

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className={labelClass}>{label}</p>
      <div className="flex min-h-10 items-center break-words rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--charcoal-800)]">
        {value}
      </div>
    </div>
  );
}

function ModalError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </p>
  );
}

function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--charcoal-900)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--charcoal-500)]">
            {description}
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="min-w-0 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [account, setAccount] = useState<MeResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [teamForm, setTeamForm] = useState<TeamForm>(emptyTeamForm);
  const [savingTeamMember, setSavingTeamMember] = useState(false);
  const [changingMemberId, setChangingMemberId] = useState<number | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamMember | null>(
    null,
  );
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPage, setTeamPage] = useState(1);
  const [membershipsPage, setMembershipsPage] = useState(1);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  /* ----------------------------- toast ------------------------------ */

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => setSuccessMessage(""), 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  /* ----------------------------- loading ---------------------------- */

  const loadAccount = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("You are not authenticated.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await apiFetch<MeResponse>("/api/accounts/me/", {
        token,
      });

      setAccount(response);
      setPhone(response.profile.phone || "");
      setEmployeeId(response.profile.employee_id || "");
      setDepartment(response.profile.department || "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load account settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const currentMembership = account?.current_organization
    ? account.organizations.find(
        (membership) =>
          membership.organization.id === account.current_organization?.id,
      )
    : null;

  const canManageTeam =
    currentMembership?.role === "owner" || currentMembership?.role === "admin";

  async function saveProfile() {
    const token = getToken();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    setSavingProfile(true);
    setError("");

    try {
      const payload = canManageTeam
        ? {
            phone,
            employee_id: employeeId || null,
            department,
          }
        : {
            phone,
          };

      const response = await apiFetch<Profile>("/api/accounts/me/profile/", {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });

      setAccount((current) =>
        current ? { ...current, profile: response } : current,
      );

      setSuccessMessage("Profile information saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  const loadTeam = useCallback(async () => {
    const token = getToken();

    if (!token || !canManageTeam) return;

    try {
      setTeamLoading(true);
      setTeamError("");

      const response = await apiFetch<TeamMember[] | { results: TeamMember[] }>(
        "/api/accounts/team/",
        { token },
      );

      setTeam(Array.isArray(response) ? response : response.results);
    } catch (err) {
      setTeamError(
        err instanceof Error ? err.message : "Failed to load team members.",
      );
    } finally {
      setTeamLoading(false);
    }
  }, [canManageTeam]);

  useEffect(() => {
    if (canManageTeam) {
      loadTeam();
    }
  }, [canManageTeam, loadTeam, account?.current_organization?.id]);

  const filteredTeam = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();

    if (!query) return team;

    return team.filter((member) =>
      [
        member.user.first_name,
        member.user.last_name,
        member.user.username,
        member.user.email,
        member.profile.phone,
        member.profile.employee_id || "",
        member.profile.department,
        member.role,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [team, teamSearch]);

  useEffect(() => {
    setTeamPage(1);
  }, [teamSearch]);

  const totalTeamPages = Math.max(
    1,
    Math.ceil(filteredTeam.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (teamPage > totalTeamPages) setTeamPage(totalTeamPages);
  }, [teamPage, totalTeamPages]);

  const paginatedTeam = useMemo(() => {
    const start = (teamPage - 1) * DEFAULT_PAGE_SIZE;
    return filteredTeam.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredTeam, teamPage]);

  const memberships = account?.organizations ?? [];

  const totalMembershipPages = Math.max(
    1,
    Math.ceil(memberships.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (membershipsPage > totalMembershipPages) {
      setMembershipsPage(totalMembershipPages);
    }
  }, [membershipsPage, totalMembershipPages]);

  const paginatedMemberships = useMemo(() => {
    const start = (membershipsPage - 1) * DEFAULT_PAGE_SIZE;
    return memberships.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [memberships, membershipsPage]);

  /* --------------------------- team form ---------------------------- */

  function openCreateTeamForm() {
    if (!canManageTeam) return;

    setEditingMemberId(null);
    setTeamForm(emptyTeamForm);
    setTeamFormOpen(true);
    setTeamError("");
  }

  function openEditTeamForm(member: TeamMember) {
    if (!canManageTeam || member.role === "owner") return;

    setEditingMemberId(member.id);

    setTeamForm({
      first_name: member.user.first_name || "",
      last_name: member.user.last_name || "",
      username: member.user.username || "",
      email: member.user.email || "",
      phone: member.profile.phone || "",
      employee_id: member.profile.employee_id || "",
      department: member.profile.department || "",
      role: member.role,
      password: "",
      confirm_password: "",
    });

    setTeamFormOpen(true);
    setTeamError("");
  }

  function closeTeamForm() {
    if (savingTeamMember) return;

    setTeamFormOpen(false);
    setEditingMemberId(null);
    setTeamForm(emptyTeamForm);
  }

  function updateTeamField<K extends keyof TeamForm>(
    field: K,
    value: TeamForm[K],
  ) {
    setTeamForm((current) => ({ ...current, [field]: value }));
  }

  async function saveTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();

    if (!token) {
      setTeamError("You are not authenticated.");
      return;
    }

    if (!canManageTeam) {
      setTeamError("You do not have permission to manage team members.");
      return;
    }

    if (
      editingMemberId === null &&
      teamForm.password !== teamForm.confirm_password
    ) {
      setTeamError("Passwords do not match.");
      return;
    }

    setSavingTeamMember(true);
    setTeamError("");
    setError("");

    try {
      if (editingMemberId === null) {
        await apiFetch("/api/accounts/team/", {
          method: "POST",
          token,
          body: JSON.stringify({
            ...teamForm,
            employee_id: teamForm.employee_id || null,
          }),
        });

        setSuccessMessage("Team member created successfully.");
      } else {
        await apiFetch(`/api/accounts/team/${editingMemberId}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            first_name: teamForm.first_name,
            last_name: teamForm.last_name,
            email: teamForm.email,
            phone: teamForm.phone,
            employee_id: teamForm.employee_id || null,
            department: teamForm.department,
            role: teamForm.role,
          }),
        });

        setSuccessMessage("Team member updated successfully.");
      }

      setTeamFormOpen(false);
      setEditingMemberId(null);
      setTeamForm(emptyTeamForm);

      await loadTeam();
    } catch (err) {
      setTeamError(
        err instanceof Error ? err.message : "Failed to save team member.",
      );
    } finally {
      setSavingTeamMember(false);
    }
  }

  async function toggleTeamMember(member: TeamMember) {
    const token = getToken();

    if (!token) {
      setTeamError("You are not authenticated.");
      return;
    }

    if (!canManageTeam || member.role === "owner") {
      setTeamError("This team member cannot be modified here.");
      return;
    }

    setChangingMemberId(member.id);
    setTeamError("");
    setError("");

    try {
      await apiFetch(`/api/accounts/team/${member.id}/`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ is_active: !member.is_active }),
      });

      setSuccessMessage(
        member.is_active
          ? "Team member deactivated successfully."
          : "Team member reactivated successfully.",
      );

      await loadTeam();
    } catch (err) {
      setTeamError(
        err instanceof Error ? err.message : "Failed to update team member.",
      );
    } finally {
      setChangingMemberId(null);
    }
  }

  /* Deactivating someone removes their access, so ask first. */
  function requestToggle(member: TeamMember) {
    if (member.is_active) {
      setDeactivateTarget(member);
      return;
    }

    void toggleTeamMember(member);
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;

    const member = deactivateTarget;

    setDeactivateTarget(null);
    await toggleTeamMember(member);
  }

  /* ----------------------------- columns ---------------------------- */

  const teamColumns: Column<TeamMember>[] = [
    {
      key: "user",
      label: "Member",
      render: (member) => {
        const fullName =
          `${member.user.first_name} ${member.user.last_name}`.trim();

        return (
          <div className="min-w-0">
            <p className="break-words font-semibold text-[var(--charcoal-900)]">
              {fullName || member.user.username}
            </p>
            <p className="mt-0.5 break-all text-xs text-[var(--charcoal-500)]">
              @{member.user.username}
            </p>
            {member.profile.employee_id && (
              <p className="mt-0.5 break-all font-mono text-xs text-[var(--charcoal-500)]">
                ID: {member.profile.employee_id}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "contact",
      label: "Contact",
      hideBelow: "md",
      render: (member) => (
        <div className="min-w-0">
          <p className="break-all text-[var(--charcoal-800)]">
            {member.user.email || "No email"}
          </p>
          <p className="mt-0.5 break-all text-xs text-[var(--charcoal-500)]">
            {member.profile.phone || "No phone"}
          </p>
        </div>
      ),
    },
    {
      key: "department",
      label: "Department",
      hideBelow: "lg",
      render: (member) => (
        <span className="break-words text-[var(--charcoal-700)]">
          {member.profile.department || "—"}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (member) => (
        <span className="font-medium text-[var(--charcoal-800)]">
          {roleLabels[member.role] || member.role}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (member) => (
        <StatusBadge status={member.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "created_at",
      label: "Joined",
      hideBelow: "lg",
      render: (member) => (
        <span className="whitespace-nowrap text-xs text-[var(--charcoal-600)]">
          {new Date(member.created_at).toLocaleDateString("en-KE")}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      render: (member) => {
        const owner = member.role === "owner";

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={owner || !canManageTeam}
              onClick={() => openEditTeamForm(member)}
            >
              Edit
            </Button>

            <Button
              size="sm"
              variant="ghost"
              disabled={owner || !canManageTeam}
              loading={changingMemberId === member.id}
              onClick={() => requestToggle(member)}
            >
              <span className={member.is_active ? "text-red-700" : undefined}>
                {member.is_active ? "Deactivate" : "Reactivate"}
              </span>
            </Button>
          </div>
        );
      },
    },
  ];

  const membershipColumns: Column<Membership>[] = [
    {
      key: "organization",
      label: "Organization",
      render: (membership) => (
        <span className="break-words font-semibold text-[var(--charcoal-900)]">
          {membership.organization.name}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (membership) => (
        <span className="text-[var(--charcoal-800)]">
          {roleLabels[membership.role] || membership.role}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      hideBelow: "sm",
      render: (membership) => (
        <StatusBadge status={membership.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "workspace",
      label: "Workspace",
      render: (membership) =>
        account?.current_organization?.id === membership.organization.id ? (
          <span className="font-medium text-[var(--emerald-700)]">Current</span>
        ) : (
          <span className="text-[var(--charcoal-400)]">—</span>
        ),
    },
  ];

  /* ------------------------------ render ---------------------------- */

  if (loading) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Manage your account, personal details, team access and business information."
          breadcrumb={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings" },
          ]}
        />
        <LoadingState rows={5} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Manage your account, personal details, team access and business information."
          breadcrumb={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings" },
          ]}
        />
        <ErrorState
          title="Settings could not be loaded"
          message={error || "Unable to load account settings."}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadAccount()}
            >
              Retry loading
            </Button>
          }
        />
      </div>
    );
  }

  const organization = account.current_organization;
  const editingMember =
    editingMemberId !== null
      ? team.find((member) => member.id === editingMemberId) ?? null
      : null;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Toast
        open={Boolean(successMessage)}
        message={successMessage}
        tone="success"
        onClose={() => setSuccessMessage("")}
      />

      <PageHeader
        title="Settings"
        subtitle="Manage your account, personal details, team access and business information."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      {error && (
        <ErrorState title="Settings operation failed" message={error} />
      )}

      {/* ACCOUNT */}
      <SettingsSection
        title="Account"
        description="Your authenticated BuildOps user account."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadOnlyField label="User ID" value={String(account.user.id)} />
          <ReadOnlyField label="Username" value={account.user.username} />
          <ReadOnlyField
            label="Email"
            value={account.user.email || "Not provided"}
          />
          <ReadOnlyField
            label="Role"
            value={
              currentMembership
                ? roleLabels[currentMembership.role] || currentMembership.role
                : "Member"
            }
          />
          <ReadOnlyField
            label="First name"
            value={account.user.first_name || "Not provided"}
          />
          <ReadOnlyField
            label="Last name"
            value={account.user.last_name || "Not provided"}
          />
        </div>
      </SettingsSection>

      {/* PROFILE */}
      <SettingsSection
        title="Profile"
        description={
          canManageTeam
            ? "Personal and employee details associated with your account."
            : "Personal contact details associated with your account. Contact an admin to update your Employee ID or Department."
        }
        action={
          <Button onClick={() => void saveProfile()} loading={savingProfile}>
            Save profile
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Phone">
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. 0712345678"
            />
          </FormField>

          {canManageTeam ? (
            <FormField label="Employee ID">
              <Input
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="Optional employee ID"
              />
            </FormField>
          ) : (
            <ReadOnlyField
              label="Employee ID"
              value={employeeId || "Not assigned"}
            />
          )}

          {canManageTeam ? (
            <FormField label="Department">
              <Input
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="e.g. Sales"
              />
            </FormField>
          ) : (
            <ReadOnlyField
              label="Department"
              value={department || "Not assigned"}
            />
          )}
        </div>
      </SettingsSection>

      {/* ORGANIZATION */}
      <SettingsSection
        title="Organization"
        description="Business details associated with your current workspace."
      >
        {organization ? (
          <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadOnlyField label="Business name" value={organization.name} />
              <ReadOnlyField
                label="Business type"
                value={organization.business_type || "Not specified"}
              />
              <ReadOnlyField
                label="Phone"
                value={organization.phone || "Not provided"}
              />
              <ReadOnlyField
                label="Email"
                value={organization.email || "Not provided"}
              />
              <ReadOnlyField
                label="Address"
                value={organization.address || "Not provided"}
              />
              <ReadOnlyField
                label="City"
                value={organization.city || "Not specified"}
              />
              <ReadOnlyField
                label="Country"
                value={organization.country || "Not specified"}
              />
              <ReadOnlyField label="Currency" value={organization.currency} />
              <ReadOnlyField label="Timezone" value={organization.timezone} />
              <ReadOnlyField
                label="Organization slug"
                value={organization.slug}
              />
            </div>

            <div className="min-w-0 border-t border-[var(--border-soft)] pt-5">
              <p className={labelClass}>Active organization</p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-h-10 min-w-0 flex-1 items-center break-words rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--charcoal-800)]">
                  {organization.name}
                </div>

                <StatusBadge variant="active">Current workspace</StatusBadge>
              </div>

              {account.organizations.length > 1 && (
                <p className="mt-3 text-xs text-[var(--charcoal-500)]">
                  Your account belongs to {account.organizations.length}{" "}
                  organizations. Workspace switching is currently disabled by
                  the application&apos;s access policy.
                </p>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No active organization selected"
            hint="Contact your organization administrator if you need help configuring your workspace access."
          />
        )}
      </SettingsSection>

      {/* TEAM & ACCESS */}
      {canManageTeam && (
        <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-[var(--charcoal-900)]">
                Team &amp; access
              </h2>
              <p className="mt-1 text-sm text-[var(--charcoal-500)]">
                Manage team members and their access to this organization. Your
                role: {roleLabels[currentMembership?.role || ""] || "Member"}.
              </p>
            </div>
            <Button onClick={openCreateTeamForm}>+ Add team member</Button>
          </div>

          {teamError && !teamFormOpen && (
            <div className="border-b border-[var(--border-soft)] p-4">
              <ErrorState
                title="Team operation failed"
                message={teamError}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadTeam()}
                  >
                    Retry loading
                  </Button>
                }
              />
            </div>
          )}

          <div className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
            <SearchBar
              value={teamSearch}
              onChange={setTeamSearch}
              onClear={() => setTeamSearch("")}
              placeholder="Search team members..."
              aria-label="Search team members"
              className="sm:max-w-sm"
            />
          </div>

          <div className="px-4 py-3">
            <p className="text-sm text-[var(--charcoal-500)]">
              Showing{" "}
              <span className="font-semibold text-[var(--charcoal-800)]">
                {filteredTeam.length}
              </span>{" "}
              of {team.length} member{team.length === 1 ? "" : "s"}
            </p>
          </div>

          {teamLoading ? (
            <div className="p-4">
              <LoadingState rows={3} />
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState
                title={
                  team.length === 0 ? "No team members yet" : "No matching members"
                }
                hint={
                  team.length === 0
                    ? "Add a team member to give colleagues access to this organization."
                    : "Try a different search term."
                }
                action={
                  team.length === 0 ? (
                    <Button onClick={openCreateTeamForm}>
                      + Add team member
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setTeamSearch("")}>
                      Clear search
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={teamColumns}
                rows={paginatedTeam}
                rowKey={(member) => member.id}
                emptyMessage="No team members found."
              />
              <Pagination
                page={teamPage}
                pageSize={DEFAULT_PAGE_SIZE}
                totalItems={filteredTeam.length}
                onPageChange={setTeamPage}
              />
            </>
          )}
        </section>
      )}

      {/* ORGANIZATION ACCESS */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--border-soft)] p-4">
          <h2 className="font-semibold text-[var(--charcoal-900)]">
            Organization access
          </h2>
          <p className="mt-1 text-sm text-[var(--charcoal-500)]">
            Your organization memberships and assigned roles.
          </p>
        </div>

        {memberships.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title="No memberships"
              hint="No organization memberships found."
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={membershipColumns}
              rows={paginatedMemberships}
              rowKey={(membership) => membership.id}
              emptyMessage="No organization memberships found."
            />
            <Pagination
              page={membershipsPage}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={memberships.length}
              onPageChange={setMembershipsPage}
            />
          </>
        )}
      </section>

      {/* SYSTEM INFORMATION */}
      <SettingsSection
        title="System information"
        description="Technical information about your BuildOps environment."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadOnlyField label="Application" value="BuildOps" />
          <ReadOnlyField label="Frontend" value="Next.js" />
          <ReadOnlyField label="Backend" value="Django + Django REST Framework" />
          <ReadOnlyField label="Database" value="PostgreSQL" />
          <ReadOnlyField label="API" value="Authenticated REST API" />
          <ReadOnlyField label="AI" value="Organization-scoped, read-only" />
        </div>
      </SettingsSection>

      {/* TEAM MEMBER MODAL */}
      <Modal
        open={teamFormOpen}
        onClose={closeTeamForm}
        title={editingMemberId === null ? "Add team member" : "Edit team member"}
        description="Configure the employee's account details and role."
        size="lg"
      >
        <form onSubmit={saveTeamMember} className="min-w-0 space-y-5">
          <ModalError message={teamError} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="First name">
              <Input
                value={teamForm.first_name}
                onChange={(event) =>
                  updateTeamField("first_name", event.target.value)
                }
                placeholder="First name"
                disabled={!canManageTeam}
              />
            </FormField>

            <FormField label="Last name">
              <Input
                value={teamForm.last_name}
                onChange={(event) =>
                  updateTeamField("last_name", event.target.value)
                }
                placeholder="Last name"
                disabled={!canManageTeam}
              />
            </FormField>

            <FormField label="Username">
              <Input
                value={teamForm.username}
                onChange={(event) =>
                  updateTeamField("username", event.target.value)
                }
                placeholder="Login username"
                disabled={editingMemberId !== null || !canManageTeam}
              />
            </FormField>

            <FormField label="Email">
              <Input
                type="email"
                value={teamForm.email}
                onChange={(event) =>
                  updateTeamField("email", event.target.value)
                }
                placeholder="employee@example.com"
                disabled={!canManageTeam}
              />
            </FormField>

            <FormField label="Phone">
              <Input
                value={teamForm.phone}
                onChange={(event) =>
                  updateTeamField("phone", event.target.value)
                }
                placeholder="0712345678"
                disabled={!canManageTeam}
              />
            </FormField>

            <FormField label="Employee ID">
              <Input
                value={teamForm.employee_id}
                onChange={(event) =>
                  updateTeamField("employee_id", event.target.value)
                }
                placeholder="Optional"
                disabled={!canManageTeam}
              />
            </FormField>

            <FormField label="Department">
              <Input
                value={teamForm.department}
                onChange={(event) =>
                  updateTeamField("department", event.target.value)
                }
                placeholder="e.g. Sales"
                disabled={!canManageTeam}
              />
            </FormField>

            <FormField label="Role">
              <Select
                value={teamForm.role}
                disabled={!canManageTeam || editingMember?.role === "owner"}
                onChange={(event) =>
                  updateTeamField("role", event.target.value)
                }
                options={teamRoles}
              />
            </FormField>

            {editingMemberId === null && (
              <>
                <FormField label="Password">
                  <Input
                    type="password"
                    value={teamForm.password}
                    onChange={(event) =>
                      updateTeamField("password", event.target.value)
                    }
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    disabled={!canManageTeam}
                  />
                </FormField>

                <FormField label="Confirm password">
                  <Input
                    type="password"
                    value={teamForm.confirm_password}
                    onChange={(event) =>
                      updateTeamField("confirm_password", event.target.value)
                    }
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    disabled={!canManageTeam}
                  />
                </FormField>
              </>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeTeamForm}
              disabled={savingTeamMember}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={savingTeamMember}
              disabled={!canManageTeam}
            >
              {editingMemberId === null ? "Create team member" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DEACTIVATE CONFIRMATION */}
      <ConfirmDialog
        open={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => void confirmDeactivate()}
        title="Deactivate team member?"
        description={
          deactivateTarget
            ? `${
                `${deactivateTarget.user.first_name} ${deactivateTarget.user.last_name}`.trim() ||
                deactivateTarget.user.username
              } will lose access to this organization until you reactivate them.`
            : "This member will lose access."
        }
        confirmLabel="Deactivate"
        cancelLabel="Keep active"
        danger
      />
    </div>
  );
}