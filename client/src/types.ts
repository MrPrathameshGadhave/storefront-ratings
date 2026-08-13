export type UserRole = "ADMIN" | "NORMAL_USER" | "STORE_OWNER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  address: string;
  role: UserRole;
  isEmailVerified?: boolean;
}

export interface Store {
  id: string;
  name: string;
  email: string;
  address: string;
  averageRating: number | null;
  ratingCount: number;
  userRating: number | null;
  owner?: Pick<AuthUser, "id" | "name" | "email"> | null;
}

export interface AdminDashboard {
  totalUsers: number;
  totalStores: number;
  totalRatings: number;
}

export interface OwnerRating {
  id: string;
  rating: number;
  createdAt?: string;
  user: Pick<AuthUser, "id" | "name" | "email" | "address">;
}

export interface OwnerDashboard {
  store: Pick<Store, "id" | "name" | "address" | "averageRating" | "ratingCount">;
  ratings: OwnerRating[];
}

export interface PageMeta {
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ListResult<T> {
  items: T[];
  meta?: PageMeta;
}

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getRecord(value: unknown, key: string): UnknownRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

export function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function getNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = getNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "ADMIN" || value === "NORMAL_USER" || value === "STORE_OWNER";
}

export function parseAuthUser(value: unknown): AuthUser | null {
  const source = getRecord(value, "user") ?? (isRecord(value) ? value : undefined);
  if (!source || !isUserRole(source.role)) {
    return null;
  }

  const id = getString(source.id);
  const email = getString(source.email);
  if (!id || !email) {
    return null;
  }

  return {
    id,
    name: getString(source.name, "Account user"),
    email,
    address: getString(source.address),
    role: source.role,
    ...(typeof (source.emailVerified ?? source.isEmailVerified) === "boolean"
      ? { isEmailVerified: Boolean(source.emailVerified ?? source.isEmailVerified) }
      : {}),
  };
}

export function parseStore(value: unknown): Store | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value.id);
  const name = getString(value.name);
  if (!id || !name) {
    return null;
  }

  const ownerSource = getRecord(value, "owner");
  const owner = ownerSource
    ? {
        id: getString(ownerSource.id),
        name: getString(ownerSource.name),
        email: getString(ownerSource.email),
      }
    : null;

  return {
    id,
    name,
    email: getString(value.email),
    address: getString(value.address),
    averageRating: getNullableNumber(value.averageRating ?? value.overallRating ?? value.rating),
    ratingCount: getNumber(value.ratingCount ?? value.totalRatings),
    userRating: getNullableNumber(value.submittedRating ?? value.userRating ?? value.myRating),
    ...(owner ? { owner } : {}),
  };
}

export function parseUser(value: unknown): AuthUser | null {
  return parseAuthUser(value);
}

export function parseList<T>(value: unknown, parser: (item: unknown) => T | null): ListResult<T> {
  const source = isRecord(value) ? value : undefined;
  const potentialItems =
    source?.items ?? source?.users ?? source?.stores ?? source?.ratings ?? value;
  const items = getArray(potentialItems)
    .map(parser)
    .filter((item): item is T => item !== null);

  const metaSource = getRecord(source, "meta");
  const total = getNullableNumber(metaSource?.total ?? source?.total);
  const page = getNullableNumber(metaSource?.page ?? source?.page);
  const pageSize = getNullableNumber(metaSource?.pageSize ?? source?.pageSize);

  const meta =
    total !== null || page !== null || pageSize !== null
      ? {
          ...(total !== null ? { total } : {}),
          ...(page !== null ? { page } : {}),
          ...(pageSize !== null ? { pageSize } : {}),
        }
      : undefined;

  return { items, ...(meta ? { meta } : {}) };
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "STORE_OWNER":
      return "Store owner";
    case "NORMAL_USER":
      return "Member";
  }
}

export function destinationForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "STORE_OWNER":
      return "/owner";
    case "NORMAL_USER":
      return "/stores";
  }
}
