import { useEffect, useState } from 'react'
import { initializeApp } from 'firebase/app'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import type { ScheduleInput, ScheduleItem } from '../types'

const storageKey = 'calendar-app-schedules'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isFirebaseReady = Object.values(firebaseConfig).every(Boolean)

const firebaseApp = isFirebaseReady ? initializeApp(firebaseConfig) : null
const firestore = firebaseApp ? getFirestore(firebaseApp) : null
const localChangeEvent = 'calendar-app:local-change'

function readLocalSchedules() {
  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as ScheduleItem[]
    return parsed.sort((left, right) =>
      left.dateKey === right.dateKey
        ? left.createdAt.localeCompare(right.createdAt)
        : left.dateKey.localeCompare(right.dateKey),
    )
  } catch {
    return []
  }
}

function writeLocalSchedules(schedules: ScheduleItem[]) {
  localStorage.setItem(storageKey, JSON.stringify(schedules))
  window.dispatchEvent(new Event(localChangeEvent))
}

function sortSchedules(schedules: ScheduleItem[]) {
  return [...schedules].sort((left, right) =>
    left.dateKey === right.dateKey
      ? left.createdAt.localeCompare(right.createdAt)
      : left.dateKey.localeCompare(right.dateKey),
  )
}

function subscribeLocal(onChange: (schedules: ScheduleItem[]) => void) {
  onChange(readLocalSchedules())

  const handleStorage = () => {
    onChange(readLocalSchedules())
  }

  const handleLocalChange = () => {
    onChange(readLocalSchedules())
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(localChangeEvent, handleLocalChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(localChangeEvent, handleLocalChange)
  }
}

async function createLocalSchedules(items: ScheduleInput[]) {
  const current = readLocalSchedules()
  const now = new Date().toISOString()

  const next = sortSchedules([
    ...current,
    ...items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })),
  ])

  writeLocalSchedules(next)
}

async function updateLocalSchedule(id: string, patch: ScheduleInput) {
  const next = readLocalSchedules().map((item) =>
    item.id === id
      ? {
          ...item,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
      : item,
  )

  writeLocalSchedules(sortSchedules(next))
}

async function deleteLocalSchedule(id: string) {
  writeLocalSchedules(readLocalSchedules().filter((item) => item.id !== id))
}

function subscribeFirebase(
  onChange: (schedules: ScheduleItem[]) => void,
  onError: (message: string) => void,
) {
  if (!firestore) {
    throw new Error('Firebase is not initialized.')
  }

  return onSnapshot(
    collection(firestore, 'schedules'),
    (snapshot) => {
      const items = snapshot.docs.map((entry) => {
        const data = entry.data() as Omit<ScheduleItem, 'id'>
        return {
          id: entry.id,
          ...data,
        }
      })

      onChange(sortSchedules(items))
    },
    (snapshotError) => {
      onError(
        snapshotError.message ||
          'Firebase との接続でエラーが発生しました。設定と Firestore ルールを確認してください。',
      )
    },
  )
}

async function createFirebaseSchedules(items: ScheduleInput[]) {
  if (!firestore) {
    throw new Error('Firebase is not initialized.')
  }

  const now = new Date().toISOString()
  await Promise.all(
    items.map((item) =>
      addDoc(collection(firestore, 'schedules'), {
        ...item,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  )
}

async function updateFirebaseSchedule(id: string, patch: ScheduleInput) {
  if (!firestore) {
    throw new Error('Firebase is not initialized.')
  }

  await updateDoc(doc(firestore, 'schedules', id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

async function deleteFirebaseSchedule(id: string) {
  if (!firestore) {
    throw new Error('Firebase is not initialized.')
  }

  await deleteDoc(doc(firestore, 'schedules', id))
}

export function useSchedules() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleChange = (items: ScheduleItem[]) => {
      setSchedules(items)
      setLoading(false)
      setError('')
    }

    const handleError = (message: string) => {
      setLoading(false)
      setError(message)
    }

    const unsubscribe = isFirebaseReady
      ? subscribeFirebase(handleChange, handleError)
      : subscribeLocal(handleChange)

    return () => unsubscribe()
  }, [])

  return {
    schedules,
    loading,
    error,
    syncMode: isFirebaseReady ? 'firebase' : 'local',
    createSchedules: async (items: ScheduleInput[]) => {
      if (isFirebaseReady) {
        return createFirebaseSchedules(items)
      }

      return createLocalSchedules(items)
    },
    updateSchedule: async (id: string, patch: ScheduleInput) => {
      if (isFirebaseReady) {
        return updateFirebaseSchedule(id, patch)
      }

      return updateLocalSchedule(id, patch)
    },
    deleteSchedule: async (id: string) => {
      if (isFirebaseReady) {
        return deleteFirebaseSchedule(id)
      }

      return deleteLocalSchedule(id)
    },
  }
}
