import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ResetPassword() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    const res = await resetPassword(token, pass);
    if (res.ok) {
      setMsg("Password reset successful!");
      setTimeout(() => nav("/login"), 1500);
    } else {
      setMsg("Reset failed.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form style={{ width: 400 }} onSubmit={submit}>
        <h2>Reset Password</h2>

        <label>New Password</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        <button style={{ marginTop: 12 }}>Reset Password</button>

        {msg && <p>{msg}</p>}
      </form>
    </div>
  );
}
