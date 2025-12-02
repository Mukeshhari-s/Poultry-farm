// src/pages/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const emailIsValid = (v) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const e = {};
    if (!form.email) e.email = "Email is required";
    else if (!emailIsValid(form.email)) e.email = "Enter a valid email";

    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be 6+ chars";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    if (!validate()) return;

    // call auth context login (stubbed for now)
    const res = await login({ email: form.email, password: form.password });
    if (res.ok) {
      nav("/dashboard");
    } else {
      setServerError(res.error || "Login failed. Try again.");
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={submit} style={styles.card} noValidate>
        <h2 style={styles.title}>Sign in to Poultry Farm</h2>

        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com"
          autoComplete="username"
        />
        {errors.email && <div style={styles.err}>{errors.email}</div>}

        <label style={styles.label}>Password</label>
        <input
          type="password"
          style={styles.input}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        {errors.password && <div style={styles.err}>{errors.password}</div>}

        {serverError && <div style={styles.serverErr}>{serverError}</div>}

        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div style={styles.row}>
          <Link to="/reset-request" style={styles.link}>
            Forgot password?
          </Link>
          <span>
            New?{" "}
            <Link to="/signup" style={styles.link}>
              Create account
            </Link>
          </span>
        </div>
      </form>
    </div>
  );
}

/* inline styles — simple and easy for beginners */
const styles = {
  container: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  card: {
    width: 420,
    padding: 20,
    borderRadius: 8,
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    background: "#fff",
  },
  title: {
    margin: "0 0 12px 0",
    fontSize: 20,
  },
  label: {
    display: "block",
    marginTop: 8,
    fontSize: 13,
    color: "#444",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    marginTop: 6,
    borderRadius: 6,
    border: "1px solid #ddd",
    fontSize: 14,
  },
  btn: {
    width: "100%",
    padding: "10px 12px",
    marginTop: 14,
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  err: { color: "#b91c1c", marginTop: 6, fontSize: 13 },
  serverErr: { color: "#b91c1c", marginTop: 10, fontSize: 14 },
  row: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
  },
  link: { color: "#2563eb", textDecoration: "none" },
};
