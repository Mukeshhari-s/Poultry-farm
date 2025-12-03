import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { loginUser, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Email and password required.");
      return;
    }

    const res = await loginUser({ email: form.email, password: form.password });
    if (!res.ok) {
      setError(res.message || "Login failed");
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="card">
      <h2>Login</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          <span>Email</span>
          <input name="email" value={form.email} onChange={onChange} type="email" />
        </label>
        <label>
          <span>Password</span>
          <input
            name="password"
            value={form.password}
            onChange={onChange}
            type="password"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
      <div className="form-footer">
        <Link to="/forgot-password">Forgot password?</Link>
        <span>
          Need an account? <Link to="/signup">Create one</Link>
        </span>
      </div>
    </div>
  );
}
