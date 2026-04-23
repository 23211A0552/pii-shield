import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, FileText, Shield, Activity, AlertTriangle, Clock, Lock, KeyRound, Eye, EyeOff } from 'lucide-react'
import { adminGetStats, adminGetDocuments, adminGetUsers, adminGetLogs } from '../services/api'
import RiskBadge from '../components/ui/RiskBadge'
import toast from 'react-hot-toast'


// Document type display map
const DOC_TYPE_META = {
  aadhaar:     { emoji: '🪪', label: 'Aadhaar'   },
  pan:         { emoji: '🗂️', label: 'PAN'        },
  passport:    { emoji: '📘', label: 'Passport'   },
  credit_card: { emoji: '💳', label: 'Card'       },
  bank:        { emoji: '🏦', label: 'Bank'       },
  general:     { emoji: '📄', label: 'General'    },
}
const getDocTypeMeta = (type) => DOC_TYPE_META[type] || DOC_TYPE_META.general

// Human-readable PII type labels (same source of truth as ScanResults)
const PII_LABELS = {
  AADHAAR:         'Aadhaar',
  AADHAAR_VID:     'Aadhaar VID',
  PAN:             'PAN Card',
  VOTER_ID:        'Voter ID',
  DRIVING_LICENCE: 'Driving Licence',
  GST:             'GST Number',
  PASSPORT_IN:     'Passport No.',
  MRZ_LINE:        'Passport MRZ',
  CREDIT_CARD:     'Credit / Debit Card',
  CVV:             'CVV',
  CARD_EXPIRY:     'Card Expiry',
  BANK_ACCOUNT_IN: 'Bank Account',
  IFSC:            'IFSC Code',
  IBAN:            'IBAN',
  SWIFT_BIC:       'SWIFT / BIC',
  SSN_US:          'SSN (US)',
  PHONE_IN:        'Phone (India)',
  PHONE_INTL:      'Phone (Intl)',
  EMAIL:           'Email',
  PERSON_NAME:     'Person Name',
  DATE_OF_BIRTH:   'Date of Birth',
  DATE_PII:        'Date',
  ADDRESS:         'Address',
  LOCATION:        'Location',
  ORGANIZATION:    'Organisation',
  IP_ADDRESS:      'IP Address',
  PINCODE_IN:      'Pincode',
}
const getPiiLabel = (type) => PII_LABELS[type] || type

// Risk bar colours
const RISK_COLORS = {
  CRITICAL: 'bg-red-700',
  HIGH:     'bg-red-500',
  MEDIUM:   'bg-yellow-500',
  LOW:      'bg-green-500',
  SAFE:     'bg-green-700',
}

export default function AdminDashboard() {
  const [stats, setStats]       = useState(null)
  const [documents, setDocuments] = useState([])
  const [users, setUsers]       = useState([])
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Showcase Mode Access
  const [isAuthorized, setIsAuthorized] = useState(sessionStorage.getItem('adminBypass') === 'Admin098')
  const [password, setPassword] = useState('')
  const [passError, setPassError] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const fetchData = () => {
    setLoading(true)
    Promise.allSettled([
      adminGetStats(),
      adminGetDocuments(),
      adminGetUsers(),
      adminGetLogs(),
    ]).then(([s, d, u, l]) => {
      if (s.status === 'fulfilled') {
        setStats(s.value.data)
        setIsAuthorized(true) // Authorized if API succeeds (either via bypass or real admin)
      } else {
        setIsAuthorized(false)
        if (sessionStorage.getItem('adminBypass')) {
            toast.error('Admin bypass failed or expired. Please login again.')
            sessionStorage.removeItem('adminBypass')
        }
      }
      
      if (d.status === 'fulfilled') setDocuments(d.value.data?.documents || [])
      if (u.status === 'fulfilled') setUsers(u.value.data?.users || u.value.data || [])
      if (l.status === 'fulfilled') setLogs(l.value.data?.logs || l.value?.logs || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchData()
  }, []) // Initial check

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (password === 'Admin098') {
      sessionStorage.setItem('adminBypass', 'Admin098')
      setPassError(false)
      fetchData() // Re-fetch with bypass header
    } else {
      setPassError(true)
      toast.error('Incorrect password')
    }
  }
  // Render password prompt if not authorized and not loading the initial check
  if (!isAuthorized && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-primary-400" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Admin Access Required</h2>
          <p className="text-white/60 mb-4 text-sm">
            Please enter the showcase password to view the admin dashboard.
          </p>

          {/* Credential hint */}
          <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4 text-left">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">Demo Credentials</p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-white/40 mb-0.5">Password</p>
                <p className="font-mono text-sm text-primary-300 font-semibold tracking-widest">Admin098</p>
              </div>
              <button
                type="button"
                onClick={() => { setPassword('Admin098'); setPassError(false); toast.success('Password filled!') }}
                className="text-xs bg-primary-600/30 hover:bg-primary-600/50 text-primary-300 px-3 py-1.5 rounded-lg transition-colors border border-primary-500/30"
              >
                Auto-fill
              </button>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPassError(false); }}
                className={`w-full bg-white/5 border ${passError ? 'border-red-500/50' : 'border-white/10 focus:border-primary-500/50'} rounded-xl py-3 pl-12 pr-12 text-white placeholder-white/40 outline-none transition-colors`}
                placeholder="Enter password..."
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Unlock Dashboard
            </button>
          </form>
        </motion.div>
      </div>
    )
  }


  const TABS = ['overview', 'documents', 'users', 'logs']

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-white/50">System-wide statistics and management</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all
              ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-white/50 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'overview' && stats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* Top stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Documents', value: stats.totalDocuments,  icon: FileText,  color: 'text-primary-400' },
              { label: 'Total Users',     value: stats.totalUsers,      icon: Users,     color: 'text-accent-400'  },
              { label: 'PII Detected',    value: stats.totalPiiDetected,icon: Shield,    color: 'text-yellow-400'  },
              { label: 'Activity Logs',   value: stats.totalLogs,       icon: Activity,  color: 'text-purple-400'  },
            ].map((s) => (
              <div key={s.label} className="glass-card p-5">
                <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
                <div className="text-3xl font-display font-bold">{s.value ?? '—'}</div>
                <div className="text-sm text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Risk breakdown */}
          <div className="glass-card p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Risk Breakdown</h2>
            <div className="space-y-3">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'SAFE'].map((level) => {
                const count = stats.riskBreakdown?.[level] ?? 0
                if (count === 0) return null
                return (
                  <div key={level} className="flex items-center gap-4">
                    <RiskBadge level={level} className="w-24" />
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${RISK_COLORS[level] || 'bg-white/30'} rounded-full transition-all`}
                        style={{ width: stats.totalDocuments ? `${(count / stats.totalDocuments) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-sm text-white/50 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* PII type breakdown (new) */}
          {stats.piiTypeBreakdown && Object.keys(stats.piiTypeBreakdown).length > 0 && (
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Top PII Types Detected</h2>
              <div className="space-y-2">
                {Object.entries(stats.piiTypeBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([type, count]) => {
                    const maxCount = Math.max(...Object.values(stats.piiTypeBreakdown))
                    return (
                      <div key={type} className="flex items-center gap-4">
                        <span className="text-xs text-white/60 w-36 truncate font-body">{getPiiLabel(type)}</span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full transition-all"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-white/50 w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Document type distribution (new) */}
          {stats.documentTypeBreakdown && Object.keys(stats.documentTypeBreakdown).length > 0 && (
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Document Types Scanned</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(stats.documentTypeBreakdown).map(([type, count]) => {
                  const meta = getDocTypeMeta(type)
                  return (
                    <div key={type} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <span className="text-2xl">{meta.emoji}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{meta.label}</div>
                        <div className="text-xs text-white/40">{count} document{count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── DOCUMENTS ────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'documents' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="font-display font-semibold">All Documents ({documents.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/40 font-medium">File</th>
                  <th className="text-left py-3 px-4 text-white/40 font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-white/40 font-medium">User</th>
                  <th className="text-left py-3 px-4 text-white/40 font-medium">Risk</th>
                  <th className="text-left py-3 px-4 text-white/40 font-medium">PII</th>
                  <th className="text-left py-3 px-4 text-white/40 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const dtMeta = getDocTypeMeta(doc.documentType)
                  return (
                    <tr key={doc.documentId} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium truncate max-w-[200px]">{doc.fileName}</div>
                      </td>
                      {/* Document type column (new) */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-xs bg-white/5 text-white/60 px-2 py-0.5 rounded-full">
                          {dtMeta.emoji} {dtMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white/50 font-mono text-xs">{doc.userId?.slice(0, 8)}…</td>
                      <td className="py-3 px-4"><RiskBadge level={doc.riskLevel} /></td>
                      <td className="py-3 px-4 text-white/70">{doc.totalPiiFound || 0}</td>
                      <td className="py-3 px-4 text-white/40">
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── USERS ────────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="font-display font-semibold">All Users ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/40 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-white/40 font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-white/40 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-xs font-bold">
                          {(u.name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white/60">{u.email}</td>
                    <td className="py-3 px-4 text-white/40">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── LOGS ─────────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'logs' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="font-display font-semibold">Activity Logs ({logs.length})</h2>
          </div>
          <div className="divide-y divide-white/5">
            {logs.slice(0, 50).map((log) => (
              <div key={log.logId} className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{log.action?.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-white/40 font-mono">{log.userId?.slice(0, 12)}…</div>
                </div>
                <div className="text-xs text-white/30 flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-center text-white/30 py-10 text-sm">No activity logs yet</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}