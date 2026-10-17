const labels: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes Requested',
  PAYMENT_PENDING: 'Pending Payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  REFUND_PENDING: 'Refund Pending',
  REFUNDED: 'Refunded',
  PENDING: 'Pending',
  VERIFIED: 'Paid',
  FAILED: 'Failed',
  REJECTED_PAYMENT: 'Rejected',
}

export function pillLabel(status: string) {
  return labels[status] ?? status.replace(/_/g, ' ')
}
