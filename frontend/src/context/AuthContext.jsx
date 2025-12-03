import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useContext,
} from "react";
import authService from "../services/authService";

export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

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

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthError(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const resolveAuthResponse = (data) => {
    if (data?.token) setToken(data.token);
    if (data?.user) setUser(data.user);
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
    [token, user, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
