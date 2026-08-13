import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFieldErrors, apiMessage, apiRequest, queryString } from "../lib/api";
import {
  normalizeEmail,
  validateAddress,
  validateEmail,
  validateName,
  validatePassword,
  type ValidationErrors,
} from "../lib/validation";
import { useToast } from "../context/ToastContext";
import {
  getNullableNumber,
  getNumber,
  getArray,
  getRecord,
  getString,
  isRecord,
  isUserRole,
  parseAuthUser,
  parseList,
  parseStore,
  roleLabel,
  type AuthUser,
  type Store,
  type UserRole,
} from "../types";
import {
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingState,
  PageHeader,
  RatingDisplay,
  SortButton,
} from "../components/ui";

type UserSort = "name" | "email" | "address" | "role" | "createdAt";
type StoreSort = "name" | "email" | "address" | "createdAt";
type SortDirection = "asc" | "desc";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  required?: boolean;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  maxLength?: number;
  multiline?: boolean;
  hint?: string;
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  type = "text",
  autoComplete,
  maxLength,
  multiline = false,
  hint,
}: TextFieldProps) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
    .filter(Boolean)
    .join(" ");
  const commonProps = {
    id,
    value,
    onChange,
    required,
    maxLength,
    autoComplete,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy || undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </label>
      {multiline ? <textarea {...commonProps} rows={4} /> : <input {...commonProps} type={type} />}
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getDashboard(value: unknown): {
  userCount: number;
  storeCount: number;
  ratingCount: number;
} {
  const source = isRecord(value) ? value : {};
  return {
    userCount: getNumber(source.userCount ?? source.totalUsers),
    storeCount: getNumber(source.storeCount ?? source.totalStores),
    ratingCount: getNumber(source.ratingCount ?? source.totalRatings),
  };
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<{
    userCount: number;
    storeCount: number;
    ratingCount: number;
  }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let current = true;
    const loadDashboard = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await apiRequest<unknown>("/admin/dashboard");
        if (current) {
          setDashboard(getDashboard(response));
        }
      } catch (requestError) {
        if (current) {
          setError(apiMessage(requestError, "We could not load the dashboard."));
        }
      } finally {
        if (current) {
          setIsLoading(false);
        }
      }
    };
    void loadDashboard();
    return () => {
      current = false;
    };
  }, [requestKey]);

  return (
    <section className="page-container">
      <PageHeader
        title="Administration overview"
        description="A concise view of activity across the StoreRate platform."
        action={
          <Link className="button button--primary" to="/admin/users/new">
            Add user
          </Link>
        }
      />
      {isLoading ? <LoadingState label="Loading dashboard" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => setRequestKey((key) => key + 1)} />
      ) : null}
      {!isLoading && !error && dashboard ? (
        <div className="metric-grid">
          <article className="metric-card">
            <p>Total users</p>
            <strong>{dashboard.userCount.toLocaleString("en-IN")}</strong>
            <span>All registered roles</span>
          </article>
          <article className="metric-card">
            <p>Registered stores</p>
            <strong>{dashboard.storeCount.toLocaleString("en-IN")}</strong>
            <span>Available in the directory</span>
          </article>
          <article className="metric-card">
            <p>Submitted ratings</p>
            <strong>{dashboard.ratingCount.toLocaleString("en-IN")}</strong>
            <span>Customer feedback received</span>
          </article>
        </div>
      ) : null}
      <div className="quick-link-grid">
        <Link to="/admin/users" className="quick-link-card">
          <span className="quick-link-card__icon" aria-hidden="true">
            ◒
          </span>
          <div>
            <h2>Manage users</h2>
            <p>Search user records, review account details, and create new accounts.</p>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
        <Link to="/admin/stores" className="quick-link-card">
          <span className="quick-link-card__icon" aria-hidden="true">
            ⌂
          </span>
          <div>
            <h2>Manage stores</h2>
            <p>Review store information, ownership, and average ratings.</p>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
        <Link to="/admin/invitations" className="quick-link-card">
          <span className="quick-link-card__icon" aria-hidden="true">
            ✉
          </span>
          <div>
            <h2>Private invitations</h2>
            <p>Create one-time registration links for administrators and store owners.</p>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

type InvitableRole = Extract<UserRole, "ADMIN" | "STORE_OWNER">;

interface InvitationFields {
  email: string;
  role: InvitableRole;
}

interface CreatedInvitation {
  token: string;
  code: string;
  role: InvitableRole;
  expiresAt: string;
  email: string;
}

const initialInvitation: InvitationFields = { email: "", role: "STORE_OWNER" };

function isInvitableRole(value: unknown): value is InvitableRole {
  return isUserRole(value) && value !== "NORMAL_USER";
}

function parseCreatedInvitation(value: unknown): CreatedInvitation | null {
  if (!isRecord(value) || !isInvitableRole(value.role)) {
    return null;
  }

  const token = getString(value.token);
  const code = getString(value.code);
  const expiresAt = getString(value.expiresAt);
  const email = getString(value.email);
  if (!token || !code || !expiresAt || !email) {
    return null;
  }

  return { token, code, role: value.role, expiresAt, email };
}

function invitationPath(role: InvitableRole, token: string): string {
  const roleSegment = role === "ADMIN" ? "admin" : "store-owner";
  return `/register/${roleSegment}/${encodeURIComponent(token)}`;
}

function invitationExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "the stated expiry time";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminInvitationsPage() {
  const { showToast } = useToast();
  const [fields, setFields] = useState<InvitationFields>(initialInvitation);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [createdInvitation, setCreatedInvitation] = useState<CreatedInvitation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField =
    (field: keyof InvitationFields) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFields((current) => ({ ...current, [field]: value }) as InvitationFields);
      setErrors((current) => ({ ...current, [field]: "" }));
      setFormError("");
      setCopyError("");
      setCreatedInvitation(null);
    };

  const createInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ValidationErrors = {};
    const emailError = validateEmail(fields.email);
    if (emailError) {
      nextErrors.email = emailError;
    }
    setErrors(nextErrors);
    setFormError("");
    setCopyError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest<unknown>("/admin/invitations", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(fields.email), role: fields.role }),
      });
      const invitation = parseCreatedInvitation(response);
      if (!invitation) {
        throw new Error("The invitation response was incomplete.");
      }
      setCreatedInvitation(invitation);
      showToast("Private invitation created. Copy the link and code now.", "success");
    } catch (error) {
      setErrors((current) => ({ ...current, ...apiFieldErrors(error) }));
      setFormError(apiMessage(error, "We could not create this private invitation."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copySecret = async (value: string, label: string) => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied.`, "success");
    } catch {
      setCopyError(
        `Copying is not available here. Select the ${label.toLowerCase()} and copy it manually.`,
      );
    }
  };

  const registrationLink = createdInvitation
    ? new URL(
        invitationPath(createdInvitation.role, createdInvitation.token),
        window.location.origin,
      ).toString()
    : "";

  return (
    <section className="page-container page-container--narrow">
      <PageHeader
        title="Private invitations"
        description="Create a one-time registration link for an administrator or store owner. The role is locked to the invitation."
        action={
          <Link className="button button--secondary" to="/admin/users">
            Back to users
          </Link>
        }
      />
      <form className="surface-card form-stack" onSubmit={createInvitation} noValidate>
        {formError ? <InlineAlert>{formError}</InlineAlert> : null}
        <TextField
          id="invitation-email"
          label="Invitee email address"
          type="email"
          value={fields.email}
          onChange={updateField("email")}
          error={errors.email}
          hint="The invite can only be used to create an account for this email address."
          autoComplete="email"
          required
        />
        <div className="field">
          <label htmlFor="invitation-role">
            Account role <span aria-hidden="true">*</span>
          </label>
          <select id="invitation-role" value={fields.role} onChange={updateField("role")}>
            <option value="STORE_OWNER">Store owner</option>
            <option value="ADMIN">Administrator</option>
          </select>
          <p className="field__hint">This permission cannot be changed by the invitee.</p>
        </div>
        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating invitation…" : "Create private invitation"}
          </button>
        </div>
      </form>

      {createdInvitation ? (
        <section className="invite-result" aria-live="polite">
          <div className="invite-result__heading">
            <div>
              <p className="eyebrow">Invitation ready</p>
              <h2>Share these two confidential details</h2>
            </div>
            <span className={`role-badge role-badge--${createdInvitation.role.toLowerCase()}`}>
              {roleLabel(createdInvitation.role)}
            </span>
          </div>
          <p>
            This invitation is bound to <strong>{createdInvitation.email}</strong> and expires on{" "}
            {invitationExpiry(createdInvitation.expiresAt)}. It is displayed only once, so copy it
            now.
          </p>
          <div className="invite-secret">
            <label htmlFor="invitation-link">Confidential registration link</label>
            <div className="invite-secret__value">
              <input
                id="invitation-link"
                value={registrationLink}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void copySecret(registrationLink, "Registration link")}
              >
                Copy link
              </button>
            </div>
          </div>
          <div className="invite-secret">
            <label htmlFor="invitation-code">Registration code</label>
            <div className="invite-secret__value">
              <input
                id="invitation-code"
                value={createdInvitation.code}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void copySecret(createdInvitation.code, "Registration code")}
              >
                Copy code
              </button>
            </div>
          </div>
          {copyError ? <InlineAlert>{copyError}</InlineAlert> : null}
        </section>
      ) : null}
    </section>
  );
}

interface UserFilters {
  name: string;
  email: string;
  address: string;
  role: "" | UserRole;
}

const initialUserFilters: UserFilters = { name: "", email: "", address: "", role: "" };

export function AdminUsersPage() {
  const [filters, setFilters] = useState<UserFilters>(initialUserFilters);
  const [submittedFilters, setSubmittedFilters] = useState<UserFilters>(initialUserFilters);
  const [sortBy, setSortBy] = useState<UserSort>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let current = true;
    const loadUsers = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await apiRequest<unknown>(
          `/admin/users${queryString({ ...submittedFilters, sortBy, sortDir })}`,
        );
        if (current) {
          setUsers(parseList(response, parseAuthUser).items);
        }
      } catch (requestError) {
        if (current) {
          setError(apiMessage(requestError, "We could not load users."));
        }
      } finally {
        if (current) {
          setIsLoading(false);
        }
      }
    };
    void loadUsers();
    return () => {
      current = false;
    };
  }, [requestKey, sortBy, sortDir, submittedFilters]);

  const updateFilter =
    (field: keyof UserFilters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFilters((current) => ({ ...current, [field]: event.target.value }) as UserFilters);
    };

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedFilters({
      name: filters.name.trim(),
      email: filters.email.trim(),
      address: filters.address.trim(),
      role: filters.role,
    });
  };

  const clearFilters = () => {
    setFilters(initialUserFilters);
    setSubmittedFilters(initialUserFilters);
  };

  const handleSort = (field: string) => {
    const nextField = field as UserSort;
    if (nextField === sortBy) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextField);
      setSortDir("asc");
    }
  };

  return (
    <section className="page-container">
      <PageHeader
        title="Users"
        description="Search across all roles and review the information administrators need."
        action={
          <Link className="button button--primary" to="/admin/users/new">
            Add user
          </Link>
        }
      />
      <form className="filter-panel" onSubmit={submitFilters}>
        <div className="filter-panel__fields">
          <label>
            <span>Name</span>
            <input
              value={filters.name}
              onChange={updateFilter("name")}
              placeholder="Filter by name"
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="search"
              value={filters.email}
              onChange={updateFilter("email")}
              placeholder="Filter by email"
            />
          </label>
          <label>
            <span>Address</span>
            <input
              value={filters.address}
              onChange={updateFilter("address")}
              placeholder="Filter by address"
            />
          </label>
          <label>
            <span>Role</span>
            <select value={filters.role} onChange={updateFilter("role")}>
              <option value="">All roles</option>
              <option value="NORMAL_USER">Member</option>
              <option value="STORE_OWNER">Store owner</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </label>
        </div>
        <div className="filter-panel__actions">
          <button type="submit" className="button button--primary">
            Apply filters
          </button>
          <button type="button" className="button button--quiet" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>
      {isLoading ? <LoadingState label="Loading users" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => setRequestKey((key) => key + 1)} />
      ) : null}
      {!isLoading && !error && users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Adjust the filters or create a new account."
          action={
            <Link className="button button--primary" to="/admin/users/new">
              Add user
            </Link>
          }
        />
      ) : null}
      {!isLoading && !error && users.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">
                  <SortButton
                    label="Name"
                    field="name"
                    activeField={sortBy}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th scope="col">
                  <SortButton
                    label="Email"
                    field="email"
                    activeField={sortBy}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th scope="col">
                  <SortButton
                    label="Address"
                    field="address"
                    activeField={sortBy}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th scope="col">
                  <SortButton
                    label="Role"
                    field="role"
                    activeField={sortBy}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Name">
                    <strong>{user.name}</strong>
                  </td>
                  <td data-label="Email">
                    <a href={`mailto:${user.email}`}>{user.email}</a>
                  </td>
                  <td data-label="Address">{user.address || "—"}</td>
                  <td data-label="Role">
                    <span className={`role-badge role-badge--${user.role.toLowerCase()}`}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="data-table__action">
                    <Link to={`/admin/users/${user.id}`} className="text-link">
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

interface AdminUserFields {
  name: string;
  email: string;
  address: string;
  password: string;
  role: UserRole;
}

const initialAdminUser: AdminUserFields = {
  name: "",
  email: "",
  address: "",
  password: "",
  role: "NORMAL_USER",
};

export function AdminUserFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [fields, setFields] = useState<AdminUserFields>(initialAdminUser);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField =
    (field: keyof AdminUserFields) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFields((current) => ({ ...current, [field]: value }) as AdminUserFields);
      setErrors((current) => ({ ...current, [field]: "" }));
    };

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ValidationErrors = {};
    const nameError = validateName(fields.name);
    const emailError = validateEmail(fields.email);
    const addressError = validateAddress(fields.address);
    const passwordError = validatePassword(fields.password);
    if (nameError) nextErrors.name = nameError;
    if (emailError) nextErrors.email = emailError;
    if (addressError) nextErrors.address = addressError;
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest<unknown>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: fields.name.trim(),
          email: normalizeEmail(fields.email),
          address: fields.address.trim(),
          password: fields.password,
          role: fields.role,
        }),
      });
      showToast("User account created.", "success");
      navigate("/admin/users");
    } catch (error) {
      setErrors((current) => ({ ...current, ...apiFieldErrors(error) }));
      setFormError(apiMessage(error, "We could not create that account."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-container page-container--narrow">
      <PageHeader
        title="Add user"
        description="Create an account with the correct platform access."
      />
      <form className="surface-card form-stack" onSubmit={submitUser} noValidate>
        {formError ? <InlineAlert>{formError}</InlineAlert> : null}
        <TextField
          id="admin-user-name"
          label="Full name"
          value={fields.name}
          onChange={updateField("name")}
          error={errors.name}
          required
          autoComplete="name"
          hint="20-60 characters."
        />
        <TextField
          id="admin-user-email"
          label="Email address"
          type="email"
          value={fields.email}
          onChange={updateField("email")}
          error={errors.email}
          required
          autoComplete="email"
        />
        <TextField
          id="admin-user-address"
          label="Address"
          value={fields.address}
          onChange={updateField("address")}
          error={errors.address}
          required
          autoComplete="street-address"
          maxLength={400}
          multiline
          hint="Up to 400 characters."
        />
        <TextField
          id="admin-user-password"
          label="Temporary password"
          type="password"
          value={fields.password}
          onChange={updateField("password")}
          error={errors.password}
          required
          autoComplete="new-password"
          hint="8-16 characters, including an uppercase letter and a special character."
        />
        <div className="field">
          <label htmlFor="admin-user-role">
            Role <span aria-hidden="true">*</span>
          </label>
          <select id="admin-user-role" value={fields.role} onChange={updateField("role")}>
            <option value="NORMAL_USER">Member</option>
            <option value="STORE_OWNER">Store owner</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
        <div className="form-actions">
          <Link className="button button--secondary" to="/admin/users">
            Cancel
          </Link>
          <button type="submit" className="button button--primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </section>
  );
}

interface UserDetail {
  user: AuthUser;
  ownerRating: number | null;
  storeName?: string;
}

function parseUserDetail(value: unknown): UserDetail | null {
  const user = parseAuthUser(value);
  if (!user) {
    return null;
  }
  const source = isRecord(value) ? value : {};
  const nestedUser = getRecord(source, "user");
  const ownedStore = getArray(source.ownedStores).find(isRecord);
  const store = getRecord(source, "store") ?? getRecord(nestedUser, "store") ?? ownedStore;
  return {
    user,
    ownerRating: getNullableNumber(
      source.averageRating ?? nestedUser?.averageRating ?? store?.averageRating,
    ),
    ...(store ? { storeName: getString(store.name) } : {}),
  };
}

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let current = true;
    const loadDetail = async () => {
      if (!id) {
        setError("This user record could not be found.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const response = await apiRequest<unknown>(`/admin/users/${id}`);
        const parsed = parseUserDetail(response);
        if (!parsed) {
          throw new Error("The user record was incomplete.");
        }
        if (current) {
          setDetail(parsed);
        }
      } catch (requestError) {
        if (current) {
          setError(apiMessage(requestError, "We could not load this user record."));
        }
      } finally {
        if (current) {
          setIsLoading(false);
        }
      }
    };
    void loadDetail();
    return () => {
      current = false;
    };
  }, [id, requestKey]);

  return (
    <section className="page-container page-container--narrow">
      <PageHeader
        title="User details"
        description="Review the account information and applicable store performance."
        action={
          <Link className="button button--secondary" to="/admin/users">
            Back to users
          </Link>
        }
      />
      {isLoading ? <LoadingState label="Loading user details" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => setRequestKey((key) => key + 1)} />
      ) : null}
      {!isLoading && !error && detail ? (
        <article className="surface-card detail-card">
          <div className="detail-card__heading">
            <div className="avatar" aria-hidden="true">
              {detail.user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2>{detail.user.name}</h2>
              <span className={`role-badge role-badge--${detail.user.role.toLowerCase()}`}>
                {roleLabel(detail.user.role)}
              </span>
            </div>
          </div>
          <dl className="details-list">
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${detail.user.email}`}>{detail.user.email}</a>
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{detail.user.address || "Not provided"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{roleLabel(detail.user.role)}</dd>
            </div>
            {detail.user.role === "STORE_OWNER" ? (
              <div>
                <dt>Store rating</dt>
                <dd>
                  {detail.storeName ? (
                    <span className="details-list__subvalue">{detail.storeName}</span>
                  ) : null}
                  <RatingDisplay rating={detail.ownerRating} />
                </dd>
              </div>
            ) : null}
          </dl>
        </article>
      ) : null}
    </section>
  );
}

export function AdminStoresPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<StoreSort>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let current = true;
    const loadStores = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await apiRequest<unknown>(
          `/admin/stores${queryString({ search, sortBy, sortDir })}`,
        );
        if (current) {
          setStores(parseList(response, parseStore).items);
        }
      } catch (requestError) {
        if (current) {
          setError(apiMessage(requestError, "We could not load stores."));
        }
      } finally {
        if (current) {
          setIsLoading(false);
        }
      }
    };
    void loadStores();
    return () => {
      current = false;
    };
  }, [requestKey, search, sortBy, sortDir]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const handleSort = (field: string) => {
    const nextField = field as StoreSort;
    if (nextField === sortBy) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextField);
      setSortDir("asc");
    }
  };

  return (
    <section className="page-container">
      <PageHeader
        title="Stores"
        description="Maintain accurate store details and keep ownership visible."
        action={
          <Link className="button button--primary" to="/admin/stores/new">
            Add store
          </Link>
        }
      />
      <div className="list-toolbar">
        <form className="search-form" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="admin-store-search">
            Search stores
          </label>
          <input
            id="admin-store-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email, or address"
          />
          <button className="button button--primary" type="submit">
            Search
          </button>
          {search ? (
            <button className="button button--quiet" type="button" onClick={clearSearch}>
              Clear
            </button>
          ) : null}
        </form>
      </div>
      {isLoading ? <LoadingState label="Loading stores" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => setRequestKey((key) => key + 1)} />
      ) : null}
      {!isLoading && !error && stores.length === 0 ? (
        <EmptyState
          title={search ? "No stores found" : "No stores have been added"}
          description={
            search
              ? "Try adjusting your search."
              : "Add the first store to make it available to members."
          }
          action={
            <Link className="button button--primary" to="/admin/stores/new">
              Add store
            </Link>
          }
        />
      ) : null}
      {!isLoading && !error && stores.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">
                  <SortButton
                    label="Name"
                    field="name"
                    activeField={sortBy}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th scope="col">
                  <SortButton
                    label="Email"
                    field="email"
                    activeField={sortBy}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th scope="col">
                  <SortButton
                    label="Address"
                    field="address"
                    activeField={sortBy}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th scope="col">Overall rating</th>
                <th scope="col">Owner</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id}>
                  <td data-label="Name">
                    <strong>{store.name}</strong>
                  </td>
                  <td data-label="Email">
                    {store.email ? <a href={`mailto:${store.email}`}>{store.email}</a> : "—"}
                  </td>
                  <td data-label="Address">{store.address || "—"}</td>
                  <td data-label="Overall rating">
                    <RatingDisplay rating={store.averageRating} count={store.ratingCount} compact />
                  </td>
                  <td data-label="Owner">{store.owner?.name || "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

interface AdminStoreFields {
  name: string;
  email: string;
  address: string;
  ownerId: string;
}

const initialStoreFields: AdminStoreFields = { name: "", email: "", address: "", ownerId: "" };

function validateStoreFields(fields: AdminStoreFields): ValidationErrors {
  const errors: ValidationErrors = {};
  const nameLength = fields.name.trim().length;
  if (!nameLength) {
    errors.name = "Store name is required.";
  } else if (nameLength < 20) {
    errors.name = "Store name must be at least 20 characters.";
  } else if (nameLength > 60) {
    errors.name = "Store name cannot exceed 60 characters.";
  }
  const emailError = validateEmail(fields.email);
  const addressError = validateAddress(fields.address);
  if (emailError) errors.email = emailError;
  if (addressError) errors.address = addressError;
  return errors;
}

export function AdminStoreFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [fields, setFields] = useState<AdminStoreFields>(initialStoreFields);
  const [owners, setOwners] = useState<AuthUser[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let current = true;
    const loadOwners = async () => {
      try {
        const response = await apiRequest<unknown>(
          `/admin/users${queryString({ role: "STORE_OWNER", sortBy: "name", sortDir: "asc" })}`,
        );
        if (current) {
          setOwners(parseList(response, parseAuthUser).items);
        }
      } catch (error) {
        if (current) {
          setFormError(
            apiMessage(
              error,
              "We could not load store owners. You can still create an unassigned store.",
            ),
          );
        }
      } finally {
        if (current) {
          setOwnersLoading(false);
        }
      }
    };
    void loadOwners();
    return () => {
      current = false;
    };
  }, []);

  const updateField =
    (field: keyof AdminStoreFields) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFields((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: "" }));
    };

  const submitStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateStoreFields(fields);
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest<unknown>("/admin/stores", {
        method: "POST",
        body: JSON.stringify({
          name: fields.name.trim(),
          email: normalizeEmail(fields.email),
          address: fields.address.trim(),
          ...(fields.ownerId ? { ownerId: fields.ownerId } : {}),
        }),
      });
      showToast("Store added to the directory.", "success");
      navigate("/admin/stores");
    } catch (error) {
      setErrors((current) => ({ ...current, ...apiFieldErrors(error) }));
      setFormError(apiMessage(error, "We could not add that store."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-container page-container--narrow">
      <PageHeader
        title="Add store"
        description="Create a store record and optionally connect its owner."
      />
      <form className="surface-card form-stack" onSubmit={submitStore} noValidate>
        {formError ? <InlineAlert>{formError}</InlineAlert> : null}
        <TextField
          id="admin-store-name"
          label="Store name"
          value={fields.name}
          onChange={updateField("name")}
          error={errors.name}
          required
          maxLength={60}
          autoComplete="organization"
        />
        <TextField
          id="admin-store-email"
          label="Store email"
          type="email"
          value={fields.email}
          onChange={updateField("email")}
          error={errors.email}
          required
          autoComplete="email"
        />
        <TextField
          id="admin-store-address"
          label="Store address"
          value={fields.address}
          onChange={updateField("address")}
          error={errors.address}
          required
          maxLength={400}
          autoComplete="street-address"
          multiline
          hint="Up to 400 characters."
        />
        <div className="field">
          <label htmlFor="admin-store-owner">Store owner</label>
          <select
            id="admin-store-owner"
            value={fields.ownerId}
            onChange={updateField("ownerId")}
            disabled={ownersLoading}
          >
            <option value="">No owner assigned</option>
            {owners.map((owner) => (
              <option value={owner.id} key={owner.id}>
                {owner.name} ({owner.email})
              </option>
            ))}
          </select>
          <p className="field__hint">
            Assign an owner now or add one later through the database administration workflow.
          </p>
        </div>
        <div className="form-actions">
          <Link className="button button--secondary" to="/admin/stores">
            Cancel
          </Link>
          <button type="submit" className="button button--primary" disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : "Add store"}
          </button>
        </div>
      </form>
    </section>
  );
}
