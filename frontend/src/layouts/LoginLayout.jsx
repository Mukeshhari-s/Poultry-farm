import React from "react";
import { Outlet } from "react-router-dom";

export default function LoginLayout() {
  return (
    <div className="auth-full">
      <section className="auth-hero login-hero">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to monitor flocks in real time</h1>
          <p>
            Access mortality trends, feed balance, and medicine history from any
            device. Secure login keeps your farm data private.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        <Outlet />
      </section>
    </div>
  );
}
