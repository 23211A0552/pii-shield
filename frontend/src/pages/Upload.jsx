import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, CheckCircle, AlertCircle, Loader, Shield, ScanLine, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { scanDocument, uploadDocument } from '../services/api'
import toast from 'react-hot-toast'

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tiff', '.tif'],
  'image/webp': ['.webp'],
}

// Human-readable extensions for the UI hint
const ACCEPTED_EXTENSIONS = 'PDF, DOCX, TXT, JPG, PNG, BMP, TIFF, WEBP'

const formatSize = bytes => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Supported document types shown in the UI
const DOC_TYPES = [
  { emoji: '🪪', label: 'Aadhaar Card' },
  { emoji: '🗂️', label: 'PAN Card' },
  { emoji: '📘', label: 'Passport' },
  { emoji: '💳', label: 'Credit / Debit Card' },
  { emoji: '🏦', label: 'Bank Statement' },
  { emoji: '📄', label: 'Any Document' },
]

const FileItem = ({ file, status, progress, onRemove }) => (
  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
    <div className="w-10 h-10 bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
      <File size={18} className="text-primary-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-white truncate">{file.name}</p>
      <p className="text-xs text-white/50 font-body">{formatSize(file.size)}</p>
      {status === 'uploading' && (
        <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
    <div className="flex-shrink-0">
      {status === 'idle'     && <button onClick={() => onRemove(file.name)} className="p-1 text-white/40 hover:text-red-500 transition-colors"><X size={16} /></button>}
      {status === 'uploading'&& <Loader size={18} className="text-primary-500 animate-spin" />}
      {status === 'done'     && <CheckCircle size={18} className="text-green-500" />}
      {status === 'error'    && <AlertCircle size={18} className="text-red-500" />}
    </div>
  </div>
)

export default function UploadPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [files, setFiles]           = useState([])
  const [statuses, setStatuses]     = useState({})
  const [progresses, setProgresses] = useState({})
  const [scanning, setScanning]     = useState(false)

  const onDrop = useCallback(accepted => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...accepted.filter(f => !existing.has(f.name))]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: 20 * 1024 * 1024,
  })

  const removeFile = name => setFiles(prev => prev.filter(f => f.name !== name))

  const uploadAndScan = async () => {
    if (!files.length) return toast.error('Please add at least one file')
    setScanning(true)

    const docIds = []
    for (const file of files) {
      setStatuses(p => ({ ...p, [file.name]: 'uploading' }))
      try {
        const { data } = await uploadDocument(file, null, (pct) => {
          setProgresses(p => ({ ...p, [file.name]: pct }))
        })
        const { documentId } = data
        setStatuses(p => ({ ...p, [file.name]: 'done' }))
        docIds.push(documentId)
        await scanDocument(documentId)
      } catch (err) {
        console.error('[Upload] Error:', err)
        setStatuses(p => ({ ...p, [file.name]: 'error' }))
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setScanning(false)
    if (docIds.length > 0) {
      toast.success(`${docIds.length} document(s) processed!`)
      setTimeout(
        () => navigate(docIds.length === 1 ? `/results/${docIds[0]}` : '/dashboard'),
        1000,
      )
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Upload Documents</h1>
        <p className="text-white/50 font-body mt-1">
          Scan for PII in Aadhaar, PAN, Passport, Bank documents, Credit Cards and more
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`glass-card p-12 text-center cursor-pointer transition-all duration-200 border-2 border-dashed
          ${isDragActive ? 'border-primary-500 bg-primary-900/20' : 'border-white/20 hover:border-primary-400 hover:bg-white/5'}`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Upload size={28} className={isDragActive ? 'text-primary-600' : 'text-primary-500'} />
        </div>
        <h3 className="font-display font-semibold text-xl text-white mb-2">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </h3>
        <p className="text-white/50 font-body text-sm mb-4">or click to browse your computer</p>
        <p className="text-xs text-white/40 font-body">
          Supports {ACCEPTED_EXTENSIONS} • Max 20 MB per file
        </p>
      </div>

      {/* Supported doc types pill row */}
      <div className="flex flex-wrap gap-2">
        {DOC_TYPES.map(({ emoji, label }) => (
          <span
            key={label}
            className="text-xs bg-white/5 border border-white/10 text-white/60 px-3 py-1 rounded-full font-body"
          >
            {emoji} {label}
          </span>
        ))}
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-6 space-y-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-semibold text-white">Selected Files ({files.length})</h3>
              {!scanning && (
                <button onClick={() => setFiles([])} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                  Clear all
                </button>
              )}
            </div>
            {files.map(file => (
              <FileItem
                key={file.name}
                file={file}
                status={statuses[file.name] || 'idle'}
                progress={progresses[file.name] || 0}
                onRemove={removeFile}
              />
            ))}
            <div className="pt-4 border-t border-white/10 flex gap-3">
              <button
                onClick={uploadAndScan}
                disabled={scanning}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
              >
                {scanning
                  ? <><Loader size={16} className="animate-spin" /> Uploading & Scanning...</>
                  : <><Upload size={16} /> Upload & Scan for PII</>
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: <ScanLine size={18} className="text-primary-400" />,
            label: 'OCR Support',
            desc: 'Scanned images processed via multi-pass Tesseract OCR with bilingual support',
          },
          {
            icon: <Shield size={18} className="text-primary-400" />,
            label: 'AI Detection',
            desc: 'Regex + spaCy NER + document-type parsers for 20+ PII categories',
          },
          {
            icon: <Lock size={18} className="text-primary-400" />,
            label: 'Secure Upload',
            desc: 'Files encrypted in transit and at rest. Auto-detected document type.',
          },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <p className="font-display font-semibold text-sm text-white">{label}</p>
            </div>
            <p className="text-xs text-white/50 font-body">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}