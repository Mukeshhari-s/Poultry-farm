import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthLayout from "./layouts/AuthLayout";
import MainLayout from "./layouts/MainLayout";
import LoginLayout from "./layouts/LoginLayout";
import SignupLayout from "./layouts/SignupLayout";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import Dashboard from "./pages/Dashboard";
import Chicks from "./pages/Chicks";
import Feed from "./pages/Feed";
import Medical from "./pages/Medical";
import DailyMonitoring from "./pages/DailyMonitoring";
import Sales from "./pages/Sales";
import CurrentReport from "./pages/CurrentReport";
import FinalReport from "./pages/FinalReport";

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="chicks" element={<Chicks />} />
          <Route path="feed" element={<Feed />} />
          <Route path="medical" element={<Medical />} />
          <Route path="daily-monitoring" element={<DailyMonitoring />} />
          <Route path="sales" element={<Sales />} />
          <Route path="current-report" element={<CurrentReport />} />
          <Route path="final-report" element={<FinalReport />} />
        </Route>

        <Route path="login" element={<LoginLayout />}>
          <Route index element={<Login />} />
        </Route>
        <Route path="signup" element={<SignupLayout />}>
          <Route index element={<Signup />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset/:token" element={<ResetPassword />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
