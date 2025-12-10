import axios from "axios";

const FALLBACK_API = "https://poultry-farm-v0k0.onrender.com/api";
const API_BASE = (import.meta.env.VITE_API_URL || FALLBACK_API).replace(/\/$/, "");

const api = axios.create({
	baseURL: API_BASE,
	headers: {
		"Content-Type": "application/json",
	},
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem("token");
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

const unwrap = (promise) => promise.then((res) => res.data);

export const authApi = {
	login: (payload) => unwrap(api.post("/auth/login", payload)),
	register: (payload) => unwrap(api.post("/auth/register", payload)),
	forgot: (payload) => unwrap(api.post("/auth/forgot", payload)),
	reset: (token, payload) => unwrap(api.post(`/auth/reset/${token}`, payload)),
};

export const flockApi = {
	list: () => unwrap(api.get("/flocks")),
	create: (payload) => unwrap(api.post("/flocks", payload)),
	update: (id, payload) => unwrap(api.patch(`/flocks/${id}`, payload)),
	close: (id, payload = {}) => unwrap(api.patch(`/flocks/${id}/close`, payload)),
	reopen: (id) => unwrap(api.patch(`/flocks/${id}/reopen`)),
	dashboardSummary: () => unwrap(api.get("/flocks/dashboard/summary")),
};

export const feedApi = {
	list: (params = {}) => unwrap(api.get("/feed", { params })),
	addIn: (payload) => unwrap(api.post("/feed/in", payload)),
	addOut: (payload) => unwrap(api.post("/feed/out", payload)),
	update: (id, payload) => unwrap(api.patch(`/feed/${id}`, payload)),
	remove: (id) => unwrap(api.delete(`/feed/${id}`)),
};

export const medicineApi = {
	list: () => unwrap(api.get("/medicine")),
	batches: () => unwrap(api.get("/medicine/batches")),
	create: (payload) => unwrap(api.post("/medicine", payload)),
	update: (id, payload) => unwrap(api.patch(`/medicine/${id}`, payload)),
	remove: (id) => unwrap(api.delete(`/medicine/${id}`)),
};

export const monitoringApi = {
	create: (payload) => unwrap(api.post("/daily", payload)),
	update: (id, payload) => unwrap(api.patch(`/daily/${id}`, payload)),
	list: (params = {}) => unwrap(api.get("/daily", { params })),
	remove: (id) => unwrap(api.delete(`/daily/${id}`)),
};

export const salesApi = {
	list: (params = {}) => unwrap(api.get("/sale", { params })),
	create: (payload) => unwrap(api.post("/sale", payload)),
	remaining: (batchNo) => unwrap(api.get(`/sale/remaining/${batchNo}`)),
	update: (id, payload) => unwrap(api.patch(`/sale/${id}`, payload)),
	remove: (id) => unwrap(api.delete(`/sale/${id}`)),
};

export const reportApi = {
	current: (params = {}) => unwrap(api.get("/current-report", { params })),
	final: (params = {}) => unwrap(api.get("/closing-report", { params })),
	finalPdf: (flockId) => api.get(`/closing-report/${flockId}/pdf`, { responseType: "blob" }),
};

export default api;
