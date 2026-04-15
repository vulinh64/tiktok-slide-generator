import { useState, useCallback, useRef } from 'react'
import './SaveToast.css'

export function useSaveToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMessage(msg)
    timerRef.current = setTimeout(() => setMessage(null), 2000)
  }, [])

  return { message, showToast }
}

export function SaveToast({ message }: { message: string | null }) {
  if (!message) return null
  return <div className="save-toast">{message}</div>
}
