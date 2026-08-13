import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { destinationForRole } from "../types";
import { useDocumentTitle } from "../components/ui";

function StatusLayout({
  code,
  title,
  description,
  action,
}: {
  code: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <main className="status-page">
      <Link className="brand" to="/" aria-label="StoreRate home">
        <span className="brand__mark" aria-hidden="true">
          S
        </span>
        <span>StoreRate</span>
      </Link>
      <section className="status-card">
        <p className="status-card__code" aria-hidden="true">
          {code}
        </p>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="status-card__actions">{action}</div>
      </section>
    </main>
  );
}

export function ForbiddenPage() {
  const { user } = useAuth();
  return (
    <StatusLayout
      code="403"
      title="This area isn’t available to your account"
      description="Your account is signed in, but it does not have permission to open this page."
      action={
        <Link
          className="button button--primary"
          to={user ? destinationForRole(user.role) : "/login"}
        >
          {user ? "Go to my workspace" : "Sign in"}
        </Link>
      }
    />
  );
}

export function NotFoundPage() {
  const { user } = useAuth();
  return (
    <StatusLayout
      code="404"
      title="We couldn’t find that page"
      description="The link may be outdated, or the page may have moved."
      action={
        <Link
          className="button button--primary"
          to={user ? destinationForRole(user.role) : "/login"}
        >
          {user ? "Go to my workspace" : "Go to sign in"}
        </Link>
      }
    />
  );
}
