import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function login(payload){
  const { data } = await axios.post(`${API_BASE}/auth/login`, payload);
  // adapt depending on your backend response shape
  return data;
}

async function signup(payload){
  const { data } = await axios.post(`${API_BASE}/auth/signup`, payload);
  return data;
}

export default { login, signup };
