import axios from 'axios'
import { auth } from '../firebase/config'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: API_BASE })

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (err) {
    console.warn('[api] Could not attach auth token:', err.message)
  }
  return config
})

// ── Document Upload ───────────────────────────────────────────────────────────
/**
 * Upload a file to the backend for text extraction.
 * Backend response: { documentId, fileName, documentType }
 *
 * @param {File}     file        - The File object from dropzone / input.
 * @param {string}   documentId  - Optional Firestore doc ID (for cache keying).
 * @param {Function} onProgress  - Optional upload progress callback (0–100).
 */
export const uploadDocument = async (file, documentId, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  if (documentId) formData.append('document_id', documentId)

  return api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
    },
  })
}

// ── PII Detection ─────────────────────────────────────────────────────────────
/**
 * Trigger PII detection on an already-uploaded document.
 *
 * Backend response shape:
 * {
 *   documentId:    string,
 *   documentType:  'aadhaar' | 'pan' | 'passport' | 'credit_card' | 'bank' | 'general',
 *   riskLevel:     'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
 *   riskScore:     number,          // 0–100
 *   piiCount:      number,
 *   piiTypesFound: string[],        // e.g. ['AADHAAR', 'PERSON_NAME', 'DATE_OF_BIRTH']
 *   results: [
 *     {
 *       id:               string,
 *       piiType:          string,   // e.g. 'AADHAAR', 'CREDIT_CARD', 'PASSPORT_IN' …
 *       detectedValue:    string,
 *       confidence:       number,   // 0–100
 *       riskLevel:        'HIGH' | 'MEDIUM' | 'LOW',
 *       detectionMethod:  string,   // 'REGEX' | 'NER' | 'AADHAAR_STRUCT' | …
 *     }
 *   ]
 * }
 */
export const scanDocument = (documentId) => {
  return api.post(`/api/scan/${documentId}`)
}

// ── Sanitize Document ─────────────────────────────────────────────────────────
/**
 * Send per-entity actions and build the sanitised document on the backend.
 *
 * @param {string} documentId
 * @param {Object} actions  - { [resultId]: 'mask' | 'remove' | 'encrypt' | 'ignore' }
 */
export const sanitizeDocument = (documentId, actions) => {
  return api.post(`/api/sanitize/${documentId}`, { actions })
}

// ── Download Sanitized Document ───────────────────────────────────────────────
export const downloadSanitized = async (documentId) => {
  const response = await api.get(`/api/download/${documentId}`, { responseType: 'blob' })
  return response.data
}

// ── User Documents ────────────────────────────────────────────────────────────
export const getUserDocuments = () => api.get('/api/documents')
export const getDocuments     = getUserDocuments

// ── Admin ─────────────────────────────────────────────────────────────────────
const getAdminHeaders = () => {
  const bypass = sessionStorage.getItem('adminBypass')
  return bypass ? { 'x-admin-bypass': bypass } : {}
}

export const getAdminStats     = ()                    => api.get('/api/admin/stats', { headers: getAdminHeaders() })
export const getAdminDocuments = (page = 1, limit = 20) => api.get(`/api/admin/documents?page=${page}&limit=${limit}`, { headers: getAdminHeaders() })
export const getAdminUsers     = ()                    => api.get('/api/admin/users', { headers: getAdminHeaders() })


// Aliases (backward-compatible)
export const getAdminAnalytics = getAdminStats
export const adminGetStats     = getAdminStats
export const adminGetDocuments = getAdminDocuments
export const adminGetUsers     = getAdminUsers
export const getActivityLogs   = ()  => api.get('/api/admin/logs', { headers: getAdminHeaders() })
export const adminGetLogs      = getActivityLogs

export default api