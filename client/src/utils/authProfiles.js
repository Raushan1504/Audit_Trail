/**
 * Forensic Operator Identity Profiles & Authentication Helpers
 */

export const DEMO_OPERATORS = [
  {
    id: 'op_aman',
    name: 'Aman Kumar',
    email: 'aman@audittrail.io',
    role: 'Lead Forensic Analyst',
    passcode: 'audit2026',
    badge: 'Person 3 · Dashboard Engineer',
    avatar: '👨‍💻'
  },
  {
    id: 'op_raushan',
    name: 'Raushan Kumar',
    email: 'raushan@audittrail.io',
    role: 'Chief Auditor & Architect',
    passcode: 'audit2026',
    badge: 'Team Lead · Event Store',
    avatar: '🛡️'
  },
  {
    id: 'op_compliance',
    name: 'Elena Rostova',
    email: 'elena@audittrail.io',
    role: 'Maritime Compliance Inspector',
    passcode: 'audit2026',
    badge: 'IMO Maritime Auditor',
    avatar: '🔍'
  }
];

/**
 * Validates operator authentication credentials.
 *
 * @param {string} email - Operator email or username
 * @param {string} passcode - Security passcode
 * @returns {{ valid: boolean, error?: string, operator?: Object }}
 */
export function validateOperatorCredentials(email, passcode) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return { valid: false, error: 'Operator email is required.' };
  }
  if (!passcode || typeof passcode !== 'string' || !passcode.trim()) {
    return { valid: false, error: 'Passcode is required.' };
  }

  const normalized = email.trim().toLowerCase();
  const matched = DEMO_OPERATORS.find((op) => op.email.toLowerCase() === normalized);

  if (matched && matched.passcode !== passcode.trim()) {
    return { valid: false, error: 'Invalid security passcode.' };
  }

  return {
    valid: true,
    operator: matched || {
      id: `op_${Date.now()}`,
      name: email.split('@')[0],
      email: normalized,
      role: 'Forensic Analyst',
      badge: 'Maritime Auditor',
      avatar: '👤'
    }
  };
}

/**
 * Generates an append-only operator session token.
 *
 * @param {string} operatorId - E.g. 'op_aman'
 * @returns {string} Session token string
 */
export function createSessionToken(operatorId) {
  const nonce = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `at_sec_${operatorId || 'guest'}_${nonce}_${ts}`;
}
