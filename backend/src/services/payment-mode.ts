export type PaymentMethod = 'ONLINE' | 'UPI' | 'BANK_TRANSFER'
export type PaymentMode = 'sandbox' | 'manual' | 'unavailable'

export function paymentModeFor(method: PaymentMethod, environment = process.env.NODE_ENV): PaymentMode {
  if (environment !== 'production') return 'sandbox'
  return method === 'BANK_TRANSFER' ? 'manual' : 'unavailable'
}
