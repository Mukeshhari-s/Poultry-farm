import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const { login } = useAuth(); // (Day 4 we replace with real signup API)
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const e = {};
    if (!form.name) e.name = "Name is required";

    if (!form.email) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email";

    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6)
      e.password = "Password must be 6+ chars";

    if (form.password !== form.confirm)
      e.confirm = "Passwords do not match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");

    if (!validate()) return;

    // For now, simulate signup by auto-login
    await login({ email: form.email, password: form.password });
    nav("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form style={card} onSubmit={submit}>
        <h2>Create an account</h2>

        {/* Name */}
        <label>Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {errors.name && <p style={err}>{errors.name}</p>}

        {/* Email */}
        <label>Email</label>
        <input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {errors.email && <p style={err}>{errors.email}</p>}

        {/* Password */}
        <label>Password</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {errors.password && <p style={err}>{errors.password}</p>}

        {/* Confirm */}
        <label>Confirm Password</label>
        <input
          type="password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
        {errors.confirm && <p style={err}>{errors.confirm}</p>}

        {serverError && <p style={err}>{serverError}</p>}

        <button style={btn} type="submit">
          Create Account
        </button>

        <p>
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

const card = {
  width: 420,
  padding: 20,
  borderRadius: 8,
  boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
  background: "#fff",
};

const btn = {
  width: "100%",
  padding: "10px 12px",
  marginTop: 14,
  background: "#111827",
  color: "#fff",
  border: 0,
  borderRadius: 6,
  cursor: "pointer",
};

const err = { color: "red", fontSize: 13, marginTop: 4 };
