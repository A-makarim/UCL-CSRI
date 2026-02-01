/**
 * API Client for ScanSan Geospatial Data
 * Handles all HTTP requests with X-Auth-Token header
 */

import axios from 'axios';

const API_KEY = import.meta.env.VITE_SCANSAN_API_KEY;
const BASE_URL = import.meta.env.VITE_SCANSAN_BASE_URL;
console.log('🔌 ScanSan API Client Config:', { BASE_URL, tokenPresent: !!API_KEY });

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-Auth-Token': API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout
});

// Diagnostic function to check API connectivity
apiClient.diagnose = async (endpoint) => {
  try {
    const response = await apiClient.get(endpoint);
    
    console.log('✅ Diagnostic Report:');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('X-Auth-Token present:', !!API_KEY);
    console.log('Response Time:', response.config.metadata?.endTime - response.config.metadata?.startTime, 'ms');
    
    return {
      success: true,
      status: response.status,
      contentType: response.headers['content-type'],
      data: response.data
    };
  } catch (error) {
    console.error('❌ Diagnostic Failed:');
    console.error('Status:', error.response?.status ?? error?.status);
    console.error('Message:', error.message);
    console.error('Content-Type:', error.response?.headers['content-type']);
    
    if (error.response?.status === 401) {
      console.error('⚠️ Authentication Error: Check X-Auth-Token validity');
    }
    
    if (error.response?.headers['content-type']?.includes('text/html')) {
      console.error('⚠️ HTML Response Detected: API might be down or endpoint is incorrect');
    }
    
    return {
      success: false,
      status: error.response?.status ?? error?.status,
      error: error.message
    };
  }
};

// Request interceptor to add metadata for timing
apiClient.interceptors.request.use((config) => {
  config.metadata = { startTime: new Date().getTime() };
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    response.config.metadata.endTime = new Date().getTime();
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error(`API Error ${error.response.status}:`, error.response.data);
      
      // Handle specific error codes
      if (error.response.status === 401) {
        const err = new Error('Authentication failed: Invalid X-Auth-Token');
        err.status = 401;
        throw err;
      } else if (error.response.status === 404) {
        const err = new Error('Endpoint not found: ' + error.config.url);
        err.status = 404;
        throw err;
      } else if (error.response.status === 429) {
        const err = new Error('Rate limit exceeded: Too many requests');
        err.status = 429;
        throw err;
      }
    } else if (error.request) {
      // Request made but no response
      console.error('No response from API:', error.request);
      throw new Error('Network error: API not responding');
    } else {
      console.error('Request configuration error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
