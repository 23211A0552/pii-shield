export const PII_RISK = {
  AADHAAR: 'HIGH',
  PAN: 'HIGH',
  CREDIT_CARD: 'HIGH',
  BANK_ACCOUNT: 'HIGH',
  PASSPORT: 'HIGH',
  PHONE: 'MEDIUM',
  EMAIL: 'MEDIUM',
  IFSC: 'MEDIUM',
  DATE_OF_BIRTH: 'MEDIUM',
  PERSON_NAME: 'LOW',
  ADDRESS: 'LOW',
  LOCATION: 'LOW',
  ORGANIZATION: 'LOW',
  IP_ADDRESS: 'LOW',
}

export const PII_LABELS = {
  AADHAAR: 'Aadhaar Number',
  PAN: 'PAN Card',
  CREDIT_CARD: 'Credit Card',
  BANK_ACCOUNT: 'Bank Account',
  PASSPORT: 'Passport',
  PHONE: 'Phone Number',
  EMAIL: 'Email Address',
  IFSC: 'IFSC Code',
  DATE_OF_BIRTH: 'Date of Birth',
  PERSON_NAME: 'Person Name',
  ADDRESS: 'Address',
  LOCATION: 'Location',
  ORGANIZATION: 'Organization',
  IP_ADDRESS: 'IP Address',
}

export const riskColor = (level) => ({
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-blue-400',
  SAFE: 'text-accent-400',
}[level] || 'text-white/50')

export const formatConfidence = (conf) => `${Math.round((conf || 0) * 100)}%`
// Client-side PII detection fallback (used in ScanResults)
export const detect_all_pii_client = (text = '') => {
  const results = []

  const patterns = {
    AADHAAR: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    PAN: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    PHONE: /\b[6-9]\d{9}\b/g,
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
    IFSC: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g
  }

  for (const [type, regex] of Object.entries(patterns)) {
    const matches = text.match(regex)
    if (matches) {
      matches.forEach((value) => {
        results.push({
          type,
          value,
          confidence: 0.9,
          risk: PII_RISK[type] || 'LOW'
        })
      })
    }
  }

  return results
}