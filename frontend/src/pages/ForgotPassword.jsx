import React, { useState } from "react";
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

    if (res.ok) setMessage("Reset link sent to your email.");
    else setErr("Something went wrong.");
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form style={{ width: 400 }} onSubmit={submit}>
        <h2>Forgot Password</h2>

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />

        {err && <p style={{ color: "red" }}>{err}</p>}
        {message && <p style={{ color: "green" }}>{message}</p>}

        <button style={{ marginTop: 12 }}>Send Reset Link</button>
      </form>
    </div>
  );
}
