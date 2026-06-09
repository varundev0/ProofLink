/**
 * Input validation helpers — applied at the API boundary before DB writes.
 * Throws with a human-readable message; callers catch and return 400.
 */

export function validateProjectInput(title: unknown, amount: unknown): void {
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Title is required.');
  }
  if (title.length > 200) {
    throw new Error('Title must be 200 characters or fewer.');
  }

  const num = typeof amount === 'number' ? amount : parseFloat(amount as string);
  if (isNaN(num) || num < 1) {
    throw new Error('Amount must be a number of at least ₹1.');
  }
  if (num > 10_000_000) {
    throw new Error('Amount cannot exceed ₹1,00,00,000.');
  }
}

export function validateDisputeInput(reason: unknown): void {
  if (typeof reason !== 'string') {
    throw new Error('Reason is required.');
  }
  if (reason.trim().length < 10) {
    throw new Error('Please provide a reason (at least 10 characters).');
  }
  if (reason.length > 2000) {
    throw new Error('Reason must be 2000 characters or fewer.');
  }
}
