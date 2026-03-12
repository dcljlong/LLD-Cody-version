import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8010/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lldv2_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lldv2_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me')
};

export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary')
};

export const jobsApi = {
  getAll: () => api.get('/jobs'),
  get: (jobId) => api.get(`/jobs/${jobId}`),
  getAnalysis: (jobId) => api.get(`/jobs/${jobId}/analysis`),
  getProgramme: (jobId) => api.get(`/jobs/${jobId}/programme`),
  upload: (jobId, formData) => api.post(`/jobs/${jobId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  generateProgrammeTasks: (jobId, data = {}) =>
    api.post(`/jobs/${jobId}/programme/generate-tasks`, data)
};

export const tasksApi = {
  getAll: (params) => api.get('/tasks', { params }),
  create: (data) => api.post('/tasks', data),
  update: (taskId, data) => api.put(`/tasks/${taskId}`, data),
  delete: (taskId) => api.delete(`/tasks/${taskId}`)
};

export const materialsApi = {
  getAll: (params) => api.get('/materials', { params }),
  create: (data) => api.post('/materials', data),
  update: (materialId, data) => api.put(`/materials/${materialId}`, data),
  delete: (materialId) => api.delete(`/materials/${materialId}`)
};

export const timesheetsApi = {
  getAll: (params) => api.get('/timesheets', { params }),
  create: (data) => api.post('/timesheets', data),
  update: (timesheetId, data) => api.put(`/timesheets/${timesheetId}`, data),
  delete: (timesheetId) => api.delete(`/timesheets/${timesheetId}`)
};

export const reportsApi = {
  getAll: (params) => api.get('/reports', { params })
};

export const subcontractorsApi = {
  getAll: (params) => api.get('/subcontractors', { params })
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data)
};

export default api;
