import { useEffect, type ReactNode } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | StoreRate`;
  }, [title]);
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">StoreRate workspace</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-card state-card--loading" role="status" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="state-card state-card--empty">
      <span className="state-card__icon" aria-hidden="true">
        ◌
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="state-card__action">{action}</div> : null}
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="state-card state-card--error" role="alert">
      <span className="state-card__icon" aria-hidden="true">
        !
      </span>
      <h2>We could not load this view</h2>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="button button--secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </section>
  );
}

export function InlineAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={`inline-alert inline-alert--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function RatingDisplay({
  rating,
  count,
  compact = false,
}: {
  rating: number | null;
  count?: number;
  compact?: boolean;
}) {
  if (rating === null) {
    return <span className="muted">No ratings yet</span>;
  }

  const label = `${rating.toFixed(1)} out of 5${count !== undefined ? ` from ${count} rating${count === 1 ? "" : "s"}` : ""}`;
  return (
    <span
      className={`rating-display${compact ? " rating-display--compact" : ""}`}
      aria-label={label}
    >
      <span className="rating-display__star" aria-hidden="true">
        ★
      </span>
      <strong>{rating.toFixed(1)}</strong>
      {count !== undefined ? <span className="muted">({count})</span> : null}
    </span>
  );
}

export function SortButton({
  label,
  field,
  activeField,
  direction,
  onSort,
}: {
  label: string;
  field: string;
  activeField: string;
  direction: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const active = field === activeField;
  const text = active ? (direction === "asc" ? "ascending" : "descending") : "not sorted";
  return (
    <button
      type="button"
      className="sort-button"
      onClick={() => onSort(field)}
      aria-label={`Sort by ${label}, currently ${text}`}
    >
      {label}
      <span
        className={`sort-button__icon${active ? " sort-button__icon--active" : ""}`}
        aria-hidden="true"
      >
        {active && direction === "desc" ? "↓" : "↑"}
      </span>
    </button>
  );
}

export function Dialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog__header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description ? <p id="dialog-description">{description}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function formatDate(value: string | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
