import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lldv2_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
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

// Projects API
export const projectsApi = {
  getAll: () => api.get('/projects'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  createDefaultGates: (id) => api.post(`/projects/${id}/gates/template`)
};

// Gates API
export const gatesApi = {
  getAll: (projectId) => api.get('/gates', { params: { project_id: projectId } }),
  get: (id) => api.get(`/gates/${id}`),
  create: (data) => api.post('/gates', data),
  update: (id, data) => api.put(`/gates/${id}`, data),
  complete: (id) => api.post(`/gates/${id}/complete`),
  reopen: (id) => api.post(`/gates/${id}/reopen`)
};

// Action Items API
export const actionItemsApi = {
  getAll: (params) => api.get('/action-items', { params }),
  get: (id) => api.get(`/action-items/${id}`),
  create: (data) => api.post('/action-items', data),
  update: (id, data) => api.put(`/action-items/${id}`, data),
  complete: (id) => api.post(`/action-items/${id}/complete`),
  reopen: (id) => api.post(`/action-items/${id}/reopen`),
  delete: (id) => api.delete(`/action-items/${id}`)
};

// Walkaround API
export const walkaroundApi = {
  getAll: (params) => api.get('/walkaround', { params }),
  create: (data) => api.post('/walkaround', data)
};

// Dashboard API
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary')
};

// Diary API
export const diaryApi = {
  get: (projectId, date) => api.get(`/diary/${projectId}`, { params: { date } })
};

// Settings API
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data)
};

// Weather API
export const weatherApi = {
  get: (lat, lon) => api.get('/weather', { params: { lat, lon } })
};

// Programme Management API
export const programmeApi = {
  upload: (projectId, pdfBase64, filename) => api.post('/programmes/upload', {
    project_id: projectId,
    pdf_base64: pdfBase64,
    filename
  }),
  getByProject: (projectId) => api.get(`/programmes/${projectId}`),
  getTasks: (programmeId) => api.get(`/programme-tasks/${programmeId}`),
  updateTaskTag: (taskId, ownerTag, isTracked) => api.put(`/programme-tasks/${taskId}/tag`, {
    owner_tag: ownerTag,
    is_tracked: isTracked
  }),
  updateTaskDates: (taskId, data) => api.put(`/programme-tasks/${taskId}/dates`, data),
  bulkTagTasks: (taskIds, ownerTag, isTracked) => api.post('/programme-tasks/bulk-tag', 
    { owner_tag: ownerTag, is_tracked: isTracked },
    { params: { task_ids: taskIds } }
  )
};

// Gate Templates API
export const gateTemplatesApi = {
  getAll: () => api.get('/gate-templates'),
  create: (data) => api.post('/gate-templates', data),
  duplicate: (templateId, newName) => api.post(`/gate-templates/${templateId}/duplicate`, null, {
    params: { new_name: newName }
  }),
  delete: (templateId) => api.delete(`/gate-templates/${templateId}`),
  applyToProject: (projectId, templateId, startDate) => api.post(
    `/projects/${projectId}/apply-template/${templateId}`,
    null,
    { params: { start_date: startDate } }
  )
};

// Notifications API
export const notificationsApi = {
  getAll: (unreadOnly = false) => api.get('/notifications', { params: { unread_only: unreadOnly } }),
  getCount: () => api.get('/notifications/count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`)
};

// Delay Notices API
export const delayNoticesApi = {
  generate: (taskId, originalDate, newDate, reason, sendEmail = true) => api.post('/delay-notices/generate', {
    task_id: taskId,
    original_date: originalDate,
    new_date: newDate,
    reason,
    send_email: sendEmail
  })
};

// Reminders API
export const remindersApi = {
  generate: () => api.post('/reminders/generate')
};

// SMTP Test API
export const smtpApi = {
  test: () => api.post('/settings/test-smtp')
};

export default api;
