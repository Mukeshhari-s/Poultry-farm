import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthLayout from "./layouts/AuthLayout";
import MainLayout from "./layouts/MainLayout";
import LoginLayout from "./layouts/LoginLayout";
import SignupLayout from "./layouts/SignupLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chicks = lazy(() => import("./pages/Chicks"));
const Feed = lazy(() => import("./pages/Feed"));
const Medical = lazy(() => import("./pages/Medical"));
const DailyMonitoring = lazy(() => import("./pages/DailyMonitoring"));
const Sales = lazy(() => import("./pages/Sales"));
const CurrentReport = lazy(() => import("./pages/CurrentReport"));
const FinalReport = lazy(() => import("./pages/FinalReport"));

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const PageLoader = () => (
  <div className="page-loading">
    <span className="page-loading__spinner" />
    <p>Loading&hellip;</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </BrowserRouter>
  );
}
