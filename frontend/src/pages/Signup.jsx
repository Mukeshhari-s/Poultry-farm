import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import EyeToggleIcon from "../components/EyeToggleIcon";

export default function Signup() {
  const navigate = useNavigate();
  const { signupUser, loading } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.mobile || !form.password) {
      setError("All fields are required.");
      return;
    }
    if (!/^\d{7,15}$/.test(form.mobile.replace(/\D/g, ""))) {
      setError("Enter a valid mobile number (7-15 digits).");
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
      mobile: form.mobile,
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
          <span>Mobile number</span>
          <input
            name="mobile"
            type="tel"
            inputMode="tel"
            value={form.mobile}
            onChange={onChange}
            placeholder="e.g. 9876543210"
          />
        </label>
        <label>
          <span>Password</span>
          <div className="password-field">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={6}
              value={form.password}
              onChange={onChange}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-icon"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              <EyeToggleIcon visible={showPassword} />
            </button>
          </div>
        </label>
        <label>
          <span>Confirm password</span>
          <div className="password-field">
            <input
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              minLength={6}
              value={form.confirmPassword}
              onChange={onChange}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-icon"
              aria-label={showConfirm ? "Hide password" : "Show password"}
              onClick={() => setShowConfirm((prev) => !prev)}
            >
              <EyeToggleIcon visible={showConfirm} />
            </button>
          </div>
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
