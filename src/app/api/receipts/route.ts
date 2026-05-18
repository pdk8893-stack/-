import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore'

function getDb() {
  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
  }
  return getFirestore()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const branch = searchParams.get('branch')
    const month = searchParams.get('month')
    const db = getDb()
    const ref = collection(db, 'receipts')
    const conditions: any[] = []
    if (branch) conditions.push(where('branch', '==', branch))
    if (month) conditions.push(where('month', '==', month))
    const q = conditions.length > 0 ? query(ref, ...conditions) : query(ref)
    const snap = await getDocs(q)
    const receipts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json(receipts)
  } catch (e: any) {
    console.error('GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { thumb, ...rest } = body
    const db = getDb()
    const ref = await addDoc(collection(db, 'receipts'), {
      ...rest,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (e: any) {
    console.error('POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 없음' }, { status: 400 })
    const db = getDb()
    await deleteDoc(doc(db, 'receipts', id))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
