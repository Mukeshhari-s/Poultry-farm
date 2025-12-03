import { authApi } from "./api";

const login = (payload) => authApi.login(payload);
const signup = (payload) => authApi.register(payload);
const forgotPassword = (email) => authApi.forgot({ email });
const resetPassword = (token, password) => authApi.reset(token, { password });

export default { login, signup, forgotPassword, resetPassword };
