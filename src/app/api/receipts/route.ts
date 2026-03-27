import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

// GET /api/receipts?branch=yongin&month=2026-03
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const branch = searchParams.get('branch')
    const month = searchParams.get('month')

    const db = getAdminDb()
    let query: FirebaseFirestore.Query = db.collection('receipts')
    if (branch) query = query.where('branch', '==', branch)
    if (month) query = query.where('month', '==', month)

    const snap = await query.orderBy('date', 'desc').get()
    const receipts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json(receipts)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/receipts  — create
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = getAdminDb()
    const ref = await db.collection('receipts').add({
      ...body,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/receipts?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 없음' }, { status: 400 })
    const db = getAdminDb()
    await db.collection('receipts').doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
