import { clsx, type ClassValue } from 'clsx'

export const cn = (...values: ClassValue[]) => clsx(values)

export const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value))

export const sentenceCase = (value: string) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1).replace(/-/g, ' ')}` : value
