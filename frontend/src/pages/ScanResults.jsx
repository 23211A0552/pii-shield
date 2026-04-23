import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { sanitizeDocument, downloadSanitized } from '../services/api'
import { Shield, Download, Eye, EyeOff, AlertTriangle, CheckCircle, ChevronLeft, Loader, RefreshCw, FileText } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const RISK_CONFIG = {
  HIGH:     { cls: 'risk-high',   bg: 'bg-red-500'    },
  MEDIUM:   { cls: 'risk-medium', bg: 'bg-yellow-500' },
  LOW:      { cls: 'risk-low',    bg: 'bg-green-500'  },
  CRITICAL: { cls: 'risk-high',   bg: 'bg-red-700'    },
}

const ACTION_OPTIONS = ['mask', 'remove', 'encrypt', 'ignore']

// ── PII type metadata: icon label + colour chip ───────────────────────────────
const PII_META = {
  // Aadhaar / Indian IDs
  AADHAAR:          { label: 'Aadhaar',          color: 'bg-red-900/40 text-red-300'      },
  AADHAAR_VID:      { label: 'Aadhaar VID',      color: 'bg-red-900/40 text-red-300'      },
  PAN:              { label: 'PAN Card',          color: 'bg-orange-900/40 text-orange-300'},
  VOTER_ID:         { label: 'Voter ID',          color: 'bg-orange-900/40 text-orange-300'},
  DRIVING_LICENCE:  { label: 'Driving Licence',   color: 'bg-orange-900/40 text-orange-300'},
  GST:              { label: 'GST Number',        color: 'bg-yellow-900/40 text-yellow-300'},
  // Passport
  PASSPORT_IN:      { label: 'Passport No.',      color: 'bg-red-900/40 text-red-300'      },
  MRZ_LINE:         { label: 'Passport MRZ',      color: 'bg-red-900/40 text-red-300'      },
  NATIONALITY:      { label: 'Nationality',       color: 'bg-blue-900/40 text-blue-300'    },
  // Financial
  CREDIT_CARD:      { label: 'Credit / Debit Card', color: 'bg-red-900/40 text-red-300'   },
  CVV:              { label: 'CVV',               color: 'bg-red-900/40 text-red-300'      },
  CARD_EXPIRY:      { label: 'Card Expiry',       color: 'bg-yellow-900/40 text-yellow-300'},
  BANK_ACCOUNT_IN:  { label: 'Bank Account',      color: 'bg-red-900/40 text-red-300'      },
  IFSC:             { label: 'IFSC Code',         color: 'bg-yellow-900/40 text-yellow-300'},
  IBAN:             { label: 'IBAN',              color: 'bg-red-900/40 text-red-300'      },
  SWIFT_BIC:        { label: 'SWIFT / BIC',       color: 'bg-yellow-900/40 text-yellow-300'},
  SSN_US:           { label: 'SSN (US)',          color: 'bg-red-900/40 text-red-300'      },
  // Contact
  PHONE_IN:         { label: 'Phone (India)',     color: 'bg-blue-900/40 text-blue-300'    },
  PHONE_INTL:       { label: 'Phone (Intl)',      color: 'bg-blue-900/40 text-blue-300'    },
  EMAIL:            { label: 'Email',             color: 'bg-blue-900/40 text-blue-300'    },
  // Personal
  PERSON_NAME:      { label: 'Person Name',       color: 'bg-purple-900/40 text-purple-300'},
  DATE_OF_BIRTH:    { label: 'Date of Birth',     color: 'bg-yellow-900/40 text-yellow-300'},
  DATE_PII:         { label: 'Date',              color: 'bg-yellow-900/40 text-yellow-300'},
  ADDRESS:          { label: 'Address',           color: 'bg-purple-900/40 text-purple-300'},
  LOCATION:         { label: 'Location',          color: 'bg-purple-900/40 text-purple-300'},
  ORGANIZATION:     { label: 'Organisation',      color: 'bg-indigo-900/40 text-indigo-300'},
  FACILITY:         { label: 'Facility',          color: 'bg-indigo-900/40 text-indigo-300'},
  // Network
  IP_ADDRESS:       { label: 'IP Address',        color: 'bg-gray-900/40 text-gray-300'    },
  PINCODE_IN:       { label: 'Pincode',           color: 'bg-gray-900/40 text-gray-300'    },
}

const DOC_TYPE_LABELS = {
  aadhaar:     '🪪 Aadhaar Card',
  pan:         '🗂️ PAN Card',
  passport:    '📘 Passport',
  credit_card: '💳 Credit / Debit Card',
  bank:        '🏦 Bank Document',
  general:     '📄 General Document',
}

const getPiiMeta = (type) =>
  PII_META[type] || { label: type, color: 'bg-white/10 text-white/60' }

export default function ScanResultsPage() {
  const { docId: documentId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [docData, setDocData]   = useState(null)
  const [results, setResults]   = useState([])
  const [actions, setActions]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [sanitizing, setSanitizing] = useState(false)
  const [showValues, setShowValues] = useState({})

  useEffect(() => {
    if (!documentId || !user) return

    setLoading(true)

    const unsubDoc = onSnapshot(doc(db, 'documents', documentId), (snap) => {
      if (snap.exists()) setDocData({ id: snap.id, ...snap.data() })
      else toast.error('Document not found')
    }, (err) => {
      console.error('Doc listener error:', err)
      toast.error('Failed to load document info')
    })

    const q = query(collection(db, 'scan_results'), where('documentId', '==', documentId))
    const unsubResults = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setResults(items)
      setActions(p => {
        const next = { ...p }
        items.forEach(r => { if (!next[r.id]) next[r.id] = 'mask' })
        return next
      })
      setLoading(false)
    }, (err) => {
      console.error('Results listener error:', err)
      setLoading(false)
      if (err.message?.includes('permissions'))
        toast.error('Firestore Permission Denied.', { duration: 6000 })
      else if (err.message?.includes('index'))
        toast.error('Firestore Index Required. Check backend logs.')
      else
        toast.error('Failed to fetch scan results')
    })

    return () => { unsubDoc(); unsubResults() }
  }, [documentId, user])

  // Use risk score from backend if available, otherwise compute from results
  const riskScore = () => {
    if (docData?.riskLevel) return docData.riskLevel
    if (!results.length) return 'UNKNOWN'
    const high = results.filter(r => r.riskLevel === 'HIGH').length
    const med  = results.filter(r => r.riskLevel === 'MEDIUM').length
    if (high >= 3) return 'CRITICAL'
    if (high >= 2 || (high >= 1 && med >= 2)) return 'HIGH'
    if (high >= 1 || med >= 2) return 'MEDIUM'
    return 'LOW'
  }

  const handleSanitize = async () => {
    setSanitizing(true)
    try {
      await sanitizeDocument(documentId, actions)
      toast.success('Document sanitized! Preparing download...')
      const blob = await downloadSanitized(documentId)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      // Preserve the original file extension (jpg stays jpg, pdf stays pdf, etc.)
      const originalName = docData?.fileName || 'document'
      a.download = `sanitized_${originalName}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Download started!')
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Sanitization failed — backend may not be running')
    } finally {
      setSanitizing(false)
    }
  }

  if (authLoading || (loading && !docData)) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader size={32} className="animate-spin text-primary-500 mx-auto mb-3" />
        <p className="text-white/50 font-body">Loading scan results...</p>
      </div>
    </div>
  )

  const score       = riskScore()
  const isSyncing   = docData?.totalPiiFound > 0 && results.length < docData.totalPiiFound
  const scoreConfig = isSyncing
    ? { cls: 'risk-low animate-pulse', bg: 'bg-white/10' }
    : (RISK_CONFIG[score] || RISK_CONFIG.LOW)

  const docTypeLabel = DOC_TYPE_LABELS[docData?.documentType] || DOC_TYPE_LABELS.general

  // Group results by risk for summary bar
  const countByRisk = ['HIGH', 'MEDIUM', 'LOW'].reduce((acc, lvl) => {
    acc[lvl] = results.filter(r => r.riskLevel === lvl).length
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-primary-400 transition-colors">
        <ChevronLeft size={16} /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">
            {docData?.fileName || 'Scan Results'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <p className="text-white/60 font-body text-sm">
              {results.length} PII entities detected
            </p>
            {/* Document type badge */}
            {docData?.documentType && (
              <span className="text-xs bg-primary-900/40 text-primary-300 px-2 py-0.5 rounded-full font-body">
                {docTypeLabel}
              </span>
            )}
            {docData?.uploadedAt?.toDate && (
              <p className="text-white/40 text-sm">
                • {new Date(docData.uploadedAt.toDate()).toLocaleString()}
              </p>
            )}
            <p className="text-primary-400/50 text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
              ID: {documentId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60"
            title="Refresh results"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${scoreConfig.cls}`}>
            {isSyncing
              ? <RefreshCw size={16} className="animate-spin" />
              : (score === 'HIGH' || score === 'CRITICAL')
                ? <AlertTriangle size={16} />
                : <CheckCircle size={16} />
            }
            <span className="font-display font-bold text-sm">
              {isSyncing ? 'CALCULATING...' : `${score} RISK`}
            </span>
          </div>
        </div>
      </div>

      {/* Risk breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {['HIGH', 'MEDIUM', 'LOW'].map(level => (
          <div key={level} className="glass-card p-5 text-center">
            <div className={`w-3 h-3 ${RISK_CONFIG[level].bg} rounded-full mx-auto mb-2`} />
            <p className="font-display font-bold text-2xl text-white">{countByRisk[level]}</p>
            <p className="text-xs text-white/50 font-body">{level} Risk</p>
          </div>
        ))}
      </div>

      {/* Results Table */}
      {results.length > 0 ? (
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-display font-semibold text-xl text-white">Detected PII</h2>
            <span className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full font-mono">
              {results.length} entities
            </span>
          </div>

          <div className="overflow-x-visible">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr className="text-left text-xs text-white/50 font-body uppercase tracking-wider">
                  {['PII Type', 'Detected Value', 'Confidence', 'Risk Level', 'Method', 'Action'].map(h => (
                    <th key={h} className="px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {results.map(result => {
                  const meta = getPiiMeta(result.piiType)
                  return (
                    <motion.tr
                      key={result.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {/* PII Type */}
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>

                      {/* Detected Value */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-sm ${showValues[result.id] ? 'text-white' : 'text-white/30'}`}>
                            {showValues[result.id]
                              ? result.detectedValue
                              : '•'.repeat(Math.min(result.detectedValue?.length || 8, 12))}
                          </span>
                          <button
                            onClick={() => setShowValues(p => ({ ...p, [result.id]: !p[result.id] }))}
                            className="text-white/40 hover:text-white/70 transition-colors"
                          >
                            {showValues[result.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </td>

                      {/* Confidence bar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden w-16">
                            <div
                              className="h-full bg-accent-500 rounded-full"
                              style={{ width: `${result.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-white/60">{result.confidence}%</span>
                        </div>
                      </td>

                      {/* Risk Level */}
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${RISK_CONFIG[result.riskLevel]?.cls || 'risk-low'}`}>
                          {result.riskLevel}
                        </span>
                      </td>

                      {/* Detection Method */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
                          {result.detectionMethod || '—'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4">
                        <select
                          value={actions[result.id] || 'mask'}
                          onChange={e => setActions(p => ({ ...p, [result.id]: e.target.value }))}
                          className="text-xs bg-gray-900 border border-white/20 text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer hover:bg-gray-800 transition-colors"
                        >
                          {ACTION_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>
                              {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className={`w-8 h-8 ${docData?.totalPiiFound > 0 ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`} />
          </div>
          <h3 className="text-xl font-bold mb-2 text-white">
            {docData?.totalPiiFound > 0 ? 'Syncing detections...' : 'No PII Detected'}
          </h3>
          <p className="text-white/50 max-w-sm mx-auto">
            {docData?.totalPiiFound > 0
              ? 'The scan identified sensitive items, but they are still being securely loaded. Please wait a moment...'
              : "Our scanner finished checking your document and found no sensitive information. It's safe to share!"}
          </p>
          {docData?.totalPiiFound > 0 && (
            <button
              onClick={() => window.location.reload()}
              className="mt-6 flex items-center gap-2 mx-auto text-primary-400 hover:text-primary-300 transition-colors"
            >
              <RefreshCw size={14} className="animate-spin" /> Refresh now
            </button>
          )}
        </div>
      )}

      {/* Download */}
      <div className="glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-lg text-white">Download Sanitized Document</h3>
          <p className="text-sm text-white/50 font-body">Apply selected actions and download a clean version</p>
        </div>
        <button
          onClick={handleSanitize}
          disabled={sanitizing || results.length === 0}
          className="btn-accent flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {sanitizing ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
          {sanitizing ? 'Processing...' : 'Download Clean File'}
        </button>
      </div>
    </div>
  )
}