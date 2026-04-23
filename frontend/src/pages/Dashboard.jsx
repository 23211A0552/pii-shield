import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Shield, AlertTriangle, CheckCircle, Upload, Clock, ArrowRight, TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getDocuments } from '../services/api'
import RiskBadge from '../components/ui/RiskBadge'

// Maps backend documentType → emoji + label
const DOC_TYPE_META = {
  aadhaar:     { emoji: '🪪', label: 'Aadhaar'      },
  pan:         { emoji: '🗂️', label: 'PAN'           },
  passport:    { emoji: '📘', label: 'Passport'      },
  credit_card: { emoji: '💳', label: 'Card'          },
  bank:        { emoji: '🏦', label: 'Bank'          },
  general:     { emoji: '📄', label: 'General'       },
}

const getDocTypeMeta = (type) => DOC_TYPE_META[type] || DOC_TYPE_META.general

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-6"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    <div className="text-3xl font-display font-bold">{value}</div>
    <div className="text-sm text-white/50 mt-1">{label}</div>
  </motion.div>
)

export default function Dashboard() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocuments()
      .then((res) => setDocuments(res.data.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const stats = {
    total:    documents.length,
    critical: documents.filter((d) => d.riskLevel === 'CRITICAL').length,
    high:     documents.filter((d) => d.riskLevel === 'HIGH').length,
    safe:     documents.filter((d) => ['LOW', 'SAFE'].includes(d.riskLevel)).length,
    totalPii: documents.reduce((acc, d) => acc + (d.totalPiiFound || 0), 0),
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-display font-bold">
          Welcome back, {user?.displayName?.split(' ')[0] || 'User'} 👋
        </h1>
        <p className="text-white/50 mt-1">Here's an overview of your document security</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}      label="Documents Scanned"  value={stats.total}                   color="text-primary-400" delay={0}   />
        <StatCard icon={AlertTriangle} label="Critical / High Risk" value={stats.critical + stats.high} color="text-red-400"     delay={0.1} />
        <StatCard icon={Shield}        label="PII Items Found"     value={stats.totalPii}                color="text-yellow-400" delay={0.2} />
        <StatCard icon={CheckCircle}   label="Clean Documents"     value={stats.safe}                    color="text-accent-400" delay={0.3} />
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="font-display font-semibold text-lg mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            to="/upload"
            className="flex items-center gap-4 p-4 rounded-xl bg-primary-600/10 border border-primary-500/20 hover:bg-primary-600/20 transition-all group"
          >
            <div className="w-12 h-12 bg-primary-600/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <div className="font-medium">Upload Document</div>
              <div className="text-sm text-white/50">Aadhaar, PAN, Passport, Bank & more</div>
            </div>
            <ArrowRight className="w-5 h-5 text-primary-400 ml-auto" />
          </Link>
          <Link
            to="/analytics"
            className="flex items-center gap-4 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20 hover:bg-accent-500/20 transition-all group"
          >
            <div className="w-12 h-12 bg-accent-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6 text-accent-400" />
            </div>
            <div>
              <div className="font-medium">View Analytics</div>
              <div className="text-sm text-white/50">Risk distribution charts</div>
            </div>
            <ArrowRight className="w-5 h-5 text-accent-400 ml-auto" />
          </Link>
        </div>
      </motion.div>

      {/* Recent Documents */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-lg">Recent Documents</h2>
          <Link to="/upload" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
            Upload new <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 glass rounded-xl animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">No documents yet</p>
            <Link to="/upload" className="btn-primary mt-4 mx-auto inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Your First Document
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.slice(0, 8).map((doc) => {
              const dtMeta = getDocTypeMeta(doc.documentType)
              return (
                <Link
                  key={doc.documentId}
                  to={`/results/${doc.documentId}`}
                  className="flex items-center gap-4 p-4 glass rounded-xl hover:bg-white/5 transition-all group"
                >
                  {/* Document type icon */}
                  <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                    {dtMeta.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{doc.fileName || 'Document'}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {/* Document type label */}
                      <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                        {dtMeta.label}
                      </span>
                      <span className="text-white/20 text-xs">•</span>
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown date'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {doc.totalPiiFound > 0 && (
                      <span className="text-sm text-white/50">{doc.totalPiiFound} PII</span>
                    )}
                    <RiskBadge level={doc.riskLevel} />
                    <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}