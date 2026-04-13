import { useState, useCallback } from 'react'

export function useSessionState<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        sessionStorage.setItem(key, JSON.stringify(v))
      } catch {
        // ignore quota errors
      }
    },
    [key],
  )

  return [value, set]
}
