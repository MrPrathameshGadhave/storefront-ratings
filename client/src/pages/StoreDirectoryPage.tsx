import { useEffect, useState, type FormEvent } from "react";
import { apiMessage, apiRequest, queryString } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { parseList, parseStore, type Store } from "../types";
import {
  Dialog,
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingState,
  PageHeader,
  RatingDisplay,
} from "../components/ui";

type StoreSort = "name" | "address" | "email" | "createdAt";
type SortDirection = "asc" | "desc";

function RatingDialog({
  store,
  onClose,
  onSaved,
}: {
  store: Store;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [value, setValue] = useState<number | null>(store.userRating);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submitRating = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value === null) {
      setError("Choose a rating from 1 to 5.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await apiRequest<unknown>(`/stores/${store.id}/rating`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      showToast(
        store.userRating === null ? "Rating submitted." : "Your rating has been updated.",
        "success",
      );
      onSaved();
      onClose();
    } catch (requestError) {
      setError(apiMessage(requestError, "We could not save your rating. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      title={store.userRating === null ? "Rate this store" : "Update your rating"}
      description={store.name}
      onClose={onClose}
    >
      <form className="form-stack dialog__body" onSubmit={submitRating}>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <fieldset className="rating-picker" disabled={isSaving}>
          <legend>How would you rate this store?</legend>
          <div className="rating-picker__options">
            {[1, 2, 3, 4, 5].map((rating) => (
              <label
                key={rating}
                className={`rating-choice${value === rating ? " rating-choice--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="store-rating"
                  value={rating}
                  checked={value === rating}
                  onChange={() => setValue(rating)}
                />
                <span aria-hidden="true">★</span>
                <strong>{rating}</strong>
                <span className="sr-only">{rating} out of 5</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="dialog__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? "Saving…" : store.userRating === null ? "Submit rating" : "Save changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function StoreDirectoryPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<StoreSort>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [requestKey, setRequestKey] = useState(0);
  const [ratingStore, setRatingStore] = useState<Store | null>(null);

  useEffect(() => {
    let current = true;
    const loadStores = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await apiRequest<unknown>(
          `/stores${queryString({ search, sortBy, sortDir })}`,
        );
        if (current) {
          setStores(parseList(response, parseStore).items);
        }
      } catch (error) {
        if (current) {
          setLoadError(apiMessage(error, "We could not load the store directory."));
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

  const resetSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  return (
    <section className="page-container">
      <PageHeader
        title="Store directory"
        description="Find a registered store, review its overall score, and share your own experience."
      />

      <section className="directory-controls" aria-label="Store directory controls">
        <form className="search-form" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="store-search">
            Search stores by name or address
          </label>
          <input
            id="store-search"
            type="search"
            placeholder="Search by store name or address"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" className="button button--primary">
            Search
          </button>
          {search ? (
            <button type="button" className="button button--quiet" onClick={resetSearch}>
              Clear
            </button>
          ) : null}
        </form>
        <div className="sort-controls">
          <label htmlFor="store-sort">Sort by</label>
          <select
            id="store-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as StoreSort)}
          >
            <option value="name">Name</option>
            <option value="address">Address</option>
            <option value="email">Email</option>
            <option value="createdAt">Recently added</option>
          </select>
          <button
            type="button"
            className="button button--secondary button--sort"
            onClick={() => setSortDir((direction) => (direction === "asc" ? "desc" : "asc"))}
            aria-label={`Switch to ${sortDir === "asc" ? "descending" : "ascending"} sort`}
          >
            {sortDir === "asc" ? "Ascending ↑" : "Descending ↓"}
          </button>
        </div>
      </section>

      {isLoading ? <LoadingState label="Loading stores" /> : null}
      {!isLoading && loadError ? (
        <ErrorState message={loadError} onRetry={() => setRequestKey((key) => key + 1)} />
      ) : null}
      {!isLoading && !loadError && stores.length === 0 ? (
        <EmptyState
          title={search ? "No stores match that search" : "No stores are available yet"}
          description={
            search
              ? "Try a shorter name, a different address, or clear the search."
              : "Check back shortly after an administrator adds stores to the platform."
          }
          action={
            search ? (
              <button type="button" className="button button--secondary" onClick={resetSearch}>
                Clear search
              </button>
            ) : undefined
          }
        />
      ) : null}
      {!isLoading && !loadError && stores.length > 0 ? (
        <div className="store-grid" aria-live="polite">
          {stores.map((store) => (
            <article className="store-card" key={store.id}>
              <div className="store-card__topline">
                <p className="store-card__eyebrow">Registered store</p>
                <RatingDisplay rating={store.averageRating} count={store.ratingCount} compact />
              </div>
              <h2>{store.name}</h2>
              <address>{store.address || "Address not available"}</address>
              {store.email ? <p className="store-card__email">{store.email}</p> : null}
              <div className="store-card__footer">
                <div>
                  <span className="field-label">Your rating</span>
                  {store.userRating === null ? (
                    <span className="muted">Not rated</span>
                  ) : (
                    <RatingDisplay rating={store.userRating} compact />
                  )}
                </div>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setRatingStore(store)}
                >
                  {store.userRating === null ? "Rate store" : "Edit rating"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {ratingStore ? (
        <RatingDialog
          store={ratingStore}
          onClose={() => setRatingStore(null)}
          onSaved={() => setRequestKey((key) => key + 1)}
        />
      ) : null}
    </section>
  );
}
