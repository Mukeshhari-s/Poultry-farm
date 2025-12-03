import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMessage("");

    if (!email) {
      setErr("Email is required");
      return;
    }

    const res = await requestPasswordReset(email);
    if (res.ok) setMessage("If the email exists, a reset link was sent.");
    else setErr(res.message || "Unable to send reset link");
  };

  return (
    <div className="card">
      <h2>Forgot password</h2>
      <form onSubmit={submit} className="form-grid">
        <label>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <button type="submit">Send reset link</button>
      </form>
      {err && <div className="error">{err}</div>}
      {message && <div className="success">{message}</div>}
      <div className="form-footer">
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  );
}
