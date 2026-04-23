import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, Shield, FileText, AlertTriangle } from 'lucide-react'
import { getDocuments } from '../services/api'

const RISK_COLORS = {
  CRITICAL: '#b91c1c',
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
  SAFE: '#3b82f6',
  UNKNOWN: '#6b7280',
}

// Human-readable labels for PII types (mirrors ScanResults + AdminDashboard)
const PII_LABELS = {
  AADHAAR: 'Aadhaar',
  AADHAAR_VID: 'Aadhaar VID',
  PAN: 'PAN Card',
  VOTER_ID: 'Voter ID',
  DRIVING_LICENCE: 'Driving Licence',
  GST: 'GST Number',
  PASSPORT_IN: 'Passport No.',
  MRZ_LINE: 'Passport MRZ',
  CREDIT_CARD: 'Credit/Debit Card',
  CVV: 'CVV',
  CARD_EXPIRY: 'Card Expiry',
  BANK_ACCOUNT_IN: 'Bank Account',
  IFSC: 'IFSC Code',
  IBAN: 'IBAN',
  SWIFT_BIC: 'SWIFT/BIC',
  SSN_US: 'SSN (US)',
  PHONE_IN: 'Phone (India)',
  PHONE_INTL: 'Phone (Intl)',
  EMAIL: 'Email',
  PERSON_NAME: 'Person Name',
  DATE_OF_BIRTH: 'Date of Birth',
  DATE_PII: 'Date',
  ADDRESS: 'Address',
  LOCATION: 'Location',
  ORGANIZATION: 'Organisation',
  IP_ADDRESS: 'IP Address',
  PINCODE_IN: 'Pincode',
}
const getPiiLabel = (type) => PII_LABELS[type] || type.replace(/_/g, ' ')

// Document type display
const DOC_TYPE_META = {
  aadhaar: { label: 'Aadhaar', color: '#6366f1' },
  pan: { label: 'PAN', color: '#f97316' },
  passport: { label: 'Passport', color: '#3b82f6' },
  credit_card: { label: 'Card', color: '#ec4899' },
  bank: { label: 'Bank', color: '#10b981' },
  general: { label: 'General', color: '#6b7280' },
}
const getDocTypeMeta = (type) => DOC_TYPE_META[type] || DOC_TYPE_META.general

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-sm">
      <p className="text-white/70 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocuments()
      .then((res) => setDocuments(res.data.documents || []))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  // ── Risk distribution pie ─────────────────────────────────────────────────
  const riskDist = Object.entries(
    documents.reduce((acc, d) => {
      const l = d.riskLevel || 'UNKNOWN'
      acc[l] = (acc[l] || 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  // ── PII type bar (human-readable labels, top 10) ──────────────────────────
  const piiTypeDist = (() => {
    const counts = {}
    documents.forEach((d) => {
      ; (d.piiTypesFound || []).forEach((t) => {
        counts[t] = (counts[t] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ name: getPiiLabel(type), count }))
  })()

  // ── Document type pie ─────────────────────────────────────────────────────
  const docTypeDist = Object.entries(
    documents.reduce((acc, d) => {
      const t = d.documentType || 'general'
      acc[t] = (acc[t] || 0) + 1
      return acc
    }, {})
  ).map(([type, value]) => ({
    name: getDocTypeMeta(type).label,
    value,
    color: getDocTypeMeta(type).color,
  }))

  // ── PII per recent document bar ───────────────────────────────────────────
  const recentDocs = documents
    .slice(0, 14)
    .reverse()
    .map((d, i) => ({
      name: d.fileName ? d.fileName.replace(/\.[^.]+$/, '').slice(0, 12) : `Doc ${i + 1}`,
      pii: d.totalPiiFound || 0,
      score: d.riskScore || 0,
    }))

  const totalPii = documents.reduce((acc, d) => acc + (d.totalPiiFound || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-display font-bold">Analytics</h1>
        <p className="text-white/50 mt-1">Insights and trends from your document scans</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Scans', value: documents.length, icon: FileText, color: 'text-primary-400' },
          { label: 'PII Detected', value: totalPii, icon: Shield, color: 'text-yellow-400' },
          { label: 'Critical / High', value: documents.filter((d) => ['CRITICAL', 'HIGH'].includes(d.riskLevel)).length, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Avg PII / Doc', value: documents.length ? (totalPii / documents.length).toFixed(1) : 0, icon: TrendingUp, color: 'text-accent-400' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5"
          >
            <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
            <div className="text-3xl font-display font-bold">{s.value}</div>
            <div className="text-sm text-white/40 mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Row 1: Risk pie + Document type pie */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Risk Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
          <h2 className="font-display font-semibold text-lg mb-6">Risk Distribution</h2>
          {riskDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={riskDist} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {riskDist.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(val) => <span style={{ color: '#fff', opacity: 0.7 }}>{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-white/30">No data yet</div>
          )}
        </motion.div>

        {/* Document Type Distribution (new) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h2 className="font-display font-semibold text-lg mb-6">Document Types Scanned</h2>
          {docTypeDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={docTypeDist} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {docTypeDist.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(val) => <span style={{ color: '#fff', opacity: 0.7 }}>{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-white/30">No data yet</div>
          )}
        </motion.div>
      </div>

      {/* Row 2: PII types bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-6">
        <h2 className="font-display font-semibold text-lg mb-6">Most Common PII Types</h2>
        {piiTypeDist.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={piiTypeDist} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Documents" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-60 text-white/30">No data yet</div>
        )}
      </motion.div>

      {/* Row 3: PII per document bar */}
      {recentDocs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h2 className="font-display font-semibold text-lg mb-6">PII Found Per Document (Recent)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={recentDocs}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={48} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pii" name="PII Found" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  )
}