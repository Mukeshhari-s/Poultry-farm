import React from "react";
import { Outlet } from "react-router-dom";

export default function SignupLayout() {
  return (
    <div className="auth-full">
      <section className="auth-hero signup-hero">
        <div>
          <p className="eyebrow">Create account</p>
          <h1>Digitize every poultry batch from day zero</h1>
          <p>
            Onboard your farm, invite teammates, and keep chick intake, feed,
            medical, and sales data in one dashboard.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        <Outlet />
      </section>
    </div>
  );
}
