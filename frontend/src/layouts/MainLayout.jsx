import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/chicks", label: "Chicks" },
  { to: "/feed", label: "Feed" },
  { to: "/medical", label: "Medical" },
  { to: "/daily-monitoring", label: "Daily" },
  { to: "/sales", label: "Sales" },
  { to: "/current-report", label: "Current" },
  { to: "/final-report", label: "Final" },
];

export default function MainLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Poultry Manager</div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="content-area">
        <header className="topbar">
          <div className="spacer" />
          <div className="header-actions">
            <Link to="/final-report" className="ghost">
              Farm closing report
            </Link>
            <span className="user-name">{user?.name}</span>
            <button onClick={logout} className="ghost">
              Logout
            </button>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
