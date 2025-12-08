import React, { useState } from "react";
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
  { to: "/performance", label: "Performance" },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleMobileNav = () => setMobileNavOpen((prev) => !prev);
  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <>
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
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={toggleMobileNav}
            >
              Menu
            </button>
            <div className="spacer" />
            <div className="header-actions">
              <Link to="/performance" className="ghost">
                Performance report
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
      <div className={`mobile-nav ${mobileNavOpen ? "open" : ""}`}>
        <div className="mobile-nav__header">
          <div className="brand">Poultry Manager</div>
          <button type="button" className="ghost" onClick={closeMobileNav}>
            Close
          </button>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={`mobile-${link.to}`}
              to={link.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={closeMobileNav}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div
        className={`mobile-nav-backdrop ${mobileNavOpen ? "show" : ""}`}
        onClick={closeMobileNav}
      />
    </>
  );
}
