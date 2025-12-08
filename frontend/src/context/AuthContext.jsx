import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useContext,
  useCallback,
} from "react";
import authService from "../services/authService";

export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const SESSION_CLOSED_AT_KEY = "authSessionClosedAt";
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(readUser);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthError(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem(SESSION_CLOSED_AT_KEY);
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (!token) {
      localStorage.removeItem(SESSION_CLOSED_AT_KEY);
      return;
    }
    const closedAtRaw = localStorage.getItem(SESSION_CLOSED_AT_KEY);
    if (closedAtRaw) {
      const closedAt = Number(closedAtRaw);
      localStorage.removeItem(SESSION_CLOSED_AT_KEY);
      if (Number.isFinite(closedAt) && Date.now() - closedAt >= SESSION_TIMEOUT_MS) {
        logout();
        return;
      }
    }
    const handleBeforeUnload = () => {
      localStorage.setItem(SESSION_CLOSED_AT_KEY, Date.now().toString());
    };
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [token, logout]);


  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const resolveAuthResponse = (data) => {
    if (data?.token) setToken(data.token);
    if (data?.user) setUser(data.user);
    if (data?.token) {
      localStorage.removeItem(SESSION_CLOSED_AT_KEY);
    }
  };

  const loginUser = async (credentials) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authService.login(credentials);
      resolveAuthResponse(data);
      return { ok: true, data };
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Login failed";
      setAuthError(message);
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  };

  const signupUser = async (payload) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authService.signup(payload);
      resolveAuthResponse(data);
      return { ok: true, data };
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Signup failed";
      setAuthError(message);
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (email) => {
    setAuthError(null);
    try {
      await authService.forgotPassword(email);
      return { ok: true };
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Request failed";
      setAuthError(message);
      return { ok: false, message };
    }
  };

  const resetPassword = async (tokenValue, password) => {
    setAuthError(null);
    try {
      await authService.resetPassword(tokenValue, password);
      return { ok: true };
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Reset failed";
      setAuthError(message);
      return { ok: false, message };
    }
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      authError,
      setAuthError,
      loginUser,
      signupUser,
      logout,
      requestPasswordReset,
      resetPassword,
    }),
    [token, user, loading, authError, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
