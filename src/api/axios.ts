import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('shastika_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (window.location.pathname !== '/login') {
        sessionStorage.removeItem('shastika_token');
        sessionStorage.removeItem('shastika_role');
        sessionStorage.removeItem('shastika_name');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
