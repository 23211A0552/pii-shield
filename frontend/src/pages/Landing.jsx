import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, Lock, Eye, FileSearch, Zap, ArrowRight,
  CheckCircle, Upload, Cpu, Download, Star, Globe
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

const FEATURES = [
  { icon: Cpu, title: 'AI-Powered Detection', desc: 'Hybrid regex + spaCy NER engine detects 10+ PII types with high accuracy', color: 'text-primary-400' },
  { icon: Lock, title: 'AES Encryption', desc: 'Military-grade encryption protects sensitive data at rest and in transit', color: 'text-accent-400' },
  { icon: Eye, title: 'Risk Classification', desc: 'Automatic risk scoring from Safe to Critical based on PII severity', color: 'text-yellow-400' },
  { icon: FileSearch, title: 'OCR Support', desc: 'Extract and scan text from images, PDFs, and scanned documents', color: 'text-purple-400' },
  { icon: Zap, title: 'Instant Results', desc: 'Get scan results in seconds with confidence scores for each detection', color: 'text-orange-400' },
  { icon: Download, title: 'Sanitized Export', desc: 'Download cleaned documents with PII masked or removed', color: 'text-blue-400' },
]

const STEPS = [
  { n: '01', title: 'Upload Document', desc: 'Drag and drop any file — PDF, image, Word doc, or plain text' },
  { n: '02', title: 'AI Scans It', desc: 'Our engine extracts text via OCR and runs PII detection in seconds' },
  { n: '03', title: 'Review Results', desc: 'See all detected PII with type, confidence score, and risk level' },
  { n: '04', title: 'Download Clean', desc: 'Mask or remove PII and export a sanitized version of your document' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-dark-950 text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-accent-500 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg">PII Shield</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary text-sm py-2 px-4">Sign In</Link>
            <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary-600/5 blur-3xl" />
        
        <motion.div
          className="relative max-w-5xl mx-auto text-center"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm text-primary-300 mb-8 border border-primary-500/20">
            <Zap className="w-4 h-4" />
            AI-Powered PII Protection
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6">
            Protect Sensitive Data<br />
            <span className="text-gradient">Before It Leaks</span>
          </motion.h1>
          
          <motion.p variants={fadeUp} className="text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload any document. Our AI instantly detects Aadhaar, PAN, bank details,
            and 10+ PII types — then lets you mask, remove, or encrypt them.
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="btn-primary text-base py-3 px-8 justify-center">
              Start Scanning Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="btn-secondary text-base py-3 px-8 justify-center">
              Sign In to Dashboard
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { n: '10+', l: 'PII Types Detected' },
              { n: '99%', l: 'Detection Accuracy' },
              { n: '<3s', l: 'Average Scan Time' },
            ].map((s) => (
              <div key={s.l} className="glass-card p-4 text-center">
                <div className="text-3xl font-display font-bold text-gradient">{s.n}</div>
                <div className="text-sm text-white/50 mt-1">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">Enterprise-Grade Protection</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">Everything you need to keep sensitive data safe in your documents</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 hover:bg-white/8 transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${f.color}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-900/5 to-transparent" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">How It Works</h2>
            <p className="text-white/50 text-lg">Four simple steps to protect your documents</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="glass-card p-6 h-full">
                  <div className="text-4xl font-display font-bold text-primary-600/40 mb-3">{step.n}</div>
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 z-10">
                    <ArrowRight className="w-5 h-5 text-primary-600/40" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PII Types */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-accent-900/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">What We Detect</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">Comprehensive coverage for Indian and global documents. Our engine automatically classifies recognized data into customizable risk levels.</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Aadhaar (UID/VID)', icon: '🪪', risk: 'HIGH' },
              { label: 'PAN Card', icon: '🏦', risk: 'HIGH' },
              { label: 'Credit Card', icon: '💳', risk: 'HIGH' },
              { label: 'Bank Account', icon: '🏧', risk: 'HIGH' },
              { label: 'Passport', icon: '🛂', risk: 'HIGH' },
              { label: 'Date of Birth', icon: '📅', risk: 'MEDIUM' },
              { label: 'Phone Number', icon: '📞', risk: 'MEDIUM' },
              { label: 'Email Address', icon: '📧', risk: 'MEDIUM' },
              { label: 'IFSC Code', icon: '🏛️', risk: 'MEDIUM' },
              { label: 'Person Names', icon: '👤', risk: 'LOW' },
              { label: 'Addresses', icon: '📍', risk: 'LOW' },
              { label: 'Organizations', icon: '🏢', risk: 'LOW' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-4 flex items-center gap-4 hover:bg-white/10 transition-colors group cursor-default"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br shadow-inner ${
                    item.risk === 'HIGH' ? 'from-red-500/20 to-red-600/20 border border-red-500/30' :
                    item.risk === 'MEDIUM' ? 'from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' :
                    'from-green-500/20 to-emerald-500/20 border border-green-500/30'
                }`}>
                  {item.icon}
                </div>
                <div>
                  <div className="font-semibold text-white/90 group-hover:text-white transition-colors">{item.label}</div>
                  <div className={`text-xs font-medium tracking-wider ${
                    item.risk === 'HIGH' ? 'text-red-400' :
                    item.risk === 'MEDIUM' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {item.risk} RISK
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto glass-card p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 to-accent-500/10" />
          <div className="relative">
            <Shield className="w-16 h-16 text-primary-400 mx-auto mb-6" />
            <h2 className="text-4xl font-display font-bold mb-4">Start Protecting Today</h2>
            <p className="text-white/60 mb-8 text-lg">Free to use. No credit card required. Scan your first document in seconds.</p>
            <Link to="/register" className="btn-primary text-lg py-4 px-10 mx-auto justify-center">
              Create Free Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10 text-center text-white/30 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-primary-400" />
          <span className="font-display font-semibold text-white/50">PII Shield</span>
        </div>
        <p>Smart Detection and Protection of Sensitive Data</p>
      </footer>
    </div>
  )
}
