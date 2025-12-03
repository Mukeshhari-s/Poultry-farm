import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const navigate = useNavigate();
  const { signupUser, loading } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const res = await signupUser({
      name: form.name,
      email: form.email,
      password: form.password,
    });

    if (!res.ok) {
      setError(res.message || "Signup failed");
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div className="card">
      <h2>Create Account</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          <span>Full name</span>
          <input name="name" value={form.name} onChange={onChange} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" value={form.email} onChange={onChange} />
        </label>
        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            minLength={6}
            value={form.password}
            onChange={onChange}
            required
          />
        </label>
        <label>
          <span>Confirm password</span>
          <input
            name="confirmPassword"
            type="password"
            minLength={6}
            value={form.confirmPassword}
            onChange={onChange}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Sign up"}
        </button>
      </form>
      <div className="form-footer">
        <span>
          Already registered? <Link to="/login">Login</Link>
        </span>
      </div>
    </div>
  );
}
