import { useEffect, useMemo, useState } from "react";
import { apiMessage, apiRequest } from "../lib/api";
import {
  getArray,
  getNumber,
  getOptionalString,
  getRecord,
  getString,
  isRecord,
  type OwnerRating,
  type Store,
} from "../types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  RatingDisplay,
  SortButton,
  formatDate,
} from "../components/ui";

type OwnerSort = "name" | "email" | "address" | "value" | "updatedAt";
type SortDirection = "asc" | "desc";

interface OwnerData {
  store: Store | null;
  raters: OwnerRating[];
}

function parseOwnerRating(value: unknown): OwnerRating | null {
  if (!isRecord(value)) {
    return null;
  }
  const user = getRecord(value, "user");
  if (!user) {
    return null;
  }
  const id = getString(value.id);
  const userId = getString(user.id);
  const name = getString(user.name);
  const email = getString(user.email);
  const rating = getNumber(value.value, Number.NaN);
  if (!id || !userId || !name || !email || !Number.isFinite(rating)) {
    return null;
  }
  return {
    id,
    rating,
    ...(getOptionalString(value.updatedAt)
      ? { createdAt: getOptionalString(value.updatedAt) }
      : {}),
    user: {
      id: userId,
      name,
      email,
      address: getString(user.address),
    },
  };
}

function parseOwnerStore(value: unknown): Store | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = getString(value.id);
  const name = getString(value.name);
  if (!id || !name) {
    return null;
  }
  const averageRating = value.averageRating;
  const parsedAverage =
    typeof averageRating === "number" && Number.isFinite(averageRating) ? averageRating : null;
  return {
    id,
    name,
    email: getString(value.email),
    address: getString(value.address),
    averageRating: parsedAverage,
    ratingCount: getNumber(value.ratingCount),
    userRating: null,
  };
}

function parseOwnerData(value: unknown): OwnerData {
  const source = isRecord(value) ? value : {};
  const store = parseOwnerStore(source.store);
  const raters = getArray(source.raters)
    .map(parseOwnerRating)
    .filter((rater): rater is OwnerRating => rater !== null);
  return { store, raters };
}

function compareRaters(left: OwnerRating, right: OwnerRating, field: OwnerSort): number {
  if (field === "value") {
    return left.rating - right.rating;
  }
  if (field === "updatedAt") {
    return new Date(left.createdAt ?? 0).valueOf() - new Date(right.createdAt ?? 0).valueOf();
  }
  return left.user[field].localeCompare(right.user[field], "en", { sensitivity: "base" });
}

export function OwnerDashboardPage() {
  const [data, setData] = useState<OwnerData>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);
  const [sortBy, setSortBy] = useState<OwnerSort>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  useEffect(() => {
    let current = true;
    const loadDashboard = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await apiRequest<unknown>("/owner/dashboard");
        if (current) {
          setData(parseOwnerData(response));
        }
      } catch (requestError) {
        if (current) {
          setError(apiMessage(requestError, "We could not load your store dashboard."));
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

  const sortedRaters = useMemo(() => {
    if (!data) {
      return [];
    }
    return [...data.raters].sort((left, right) => {
      const comparison = compareRaters(left, right, sortBy);
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [data, sortBy, sortDir]);

  const handleSort = (field: string) => {
    const nextField = field as OwnerSort;
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
        title="Store performance"
        description="See how customers are rating your assigned store."
      />
      {isLoading ? <LoadingState label="Loading store performance" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => setRequestKey((key) => key + 1)} />
      ) : null}
      {!isLoading && !error && data?.store === null ? (
        <EmptyState
          title="No store is assigned to this account"
          description="Ask an administrator to connect your owner account with a store."
        />
      ) : null}
      {!isLoading && !error && data?.store ? (
        <>
          <section className="owner-summary" aria-label="Store rating summary">
            <div>
              <p className="eyebrow">Your store</p>
              <h2>{data.store.name}</h2>
              <address>{data.store.address || "Address not available"}</address>
            </div>
            <div className="owner-summary__score">
              <p>Average rating</p>
              <RatingDisplay rating={data.store.averageRating} count={data.store.ratingCount} />
            </div>
          </section>
          {sortedRaters.length === 0 ? (
            <EmptyState
              title="No customer ratings yet"
              description="When a member submits feedback for your store, it will appear here."
            />
          ) : (
            <section className="surface-card data-section">
              <div className="data-section__heading">
                <div>
                  <h2>Customer ratings</h2>
                  <p>
                    {sortedRaters.length} submitted rating{sortedRaters.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <SortButton
                          label="Customer"
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
                          label="Rating"
                          field="value"
                          activeField={sortBy}
                          direction={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th scope="col">
                        <SortButton
                          label="Updated"
                          field="updatedAt"
                          activeField={sortBy}
                          direction={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRaters.map((rater) => (
                      <tr key={rater.id}>
                        <td data-label="Customer">
                          <strong>{rater.user.name}</strong>
                        </td>
                        <td data-label="Email">
                          <a href={`mailto:${rater.user.email}`}>{rater.user.email}</a>
                        </td>
                        <td data-label="Address">{rater.user.address || "—"}</td>
                        <td data-label="Rating">
                          <RatingDisplay rating={rater.rating} compact />
                        </td>
                        <td data-label="Updated">{formatDate(rater.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : null}
    </section>
  );
}
