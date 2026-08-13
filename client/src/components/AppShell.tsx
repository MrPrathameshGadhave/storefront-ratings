import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { destinationForRole, roleLabel } from "../types";

interface NavigationItem {
  to: string;
  label: string;
  end?: boolean;
}

function navigationFor(role: "ADMIN" | "NORMAL_USER" | "STORE_OWNER"): NavigationItem[] {
  if (role === "ADMIN") {
    return [
      { to: "/admin", label: "Overview", end: true },
      { to: "/admin/users", label: "Users" },
      { to: "/admin/stores", label: "Stores" },
      { to: "/admin/invitations", label: "Invitations" },
      { to: "/password", label: "Password" },
    ];
  }

  if (role === "STORE_OWNER") {
    return [
      { to: "/owner", label: "Dashboard", end: true },
      { to: "/password", label: "Password" },
    ];
  }

  return [
    { to: "/stores", label: "Store directory", end: true },
    { to: "/password", label: "Password" },
  ];
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) {
    return null;
  }

  const links = navigationFor(user.role);

  const handleSignOut = async () => {
    await signOut();
    showToast("You have been signed out.", "success");
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <NavLink className="brand" to={destinationForRole(user.role)} aria-label="StoreRate home">
            <span className="brand__mark" aria-hidden="true">
              S
            </span>
            <span>StoreRate</span>
          </NavLink>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">Toggle navigation</span>
            <span aria-hidden="true">☰</span>
          </button>

          <nav
            id="primary-navigation"
            className={`primary-nav ${menuOpen ? "primary-nav--open" : ""}`}
            aria-label="Primary navigation"
          >
            <div className="primary-nav__links">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
            <div className="account-menu">
              <div className="account-menu__identity">
                <span className="account-menu__name">{user.name}</span>
                <span className="account-menu__role">{roleLabel(user.role)}</span>
              </div>
              <button type="button" className="button button--quiet" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
