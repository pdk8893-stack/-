'use client'
import { useState, useEffect, useRef } from 'react'

type Receipt = {
  id: string
  branch: string
  month: string
  vendor: string
  store: string
  amount: number
  date: string
  category: string
  items: string
  thumb?: string
}

const BRANCHES = [
  { key: 'yongin', label: '용인점', accent: '#f0c040', bg: '#1e1c10' },
  { key: 'osan',   label: '오산점',  accent: '#e87c40', bg: '#1e1510' },
]

function fmt(n: number) { return '₩' + Math.round(n).toLocaleString('ko-KR') }
function monthKey(y: number, m: number) { return `${y}-${String(m + 1).padStart(2, '0')}` }

export default function ReceiptApp() {
  const [branch, setBranch] = useState('yongin')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [processing, setProcessing] = useState<{ id: string; name: string }[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const branchInfo = BRANCHES.find(b => b.key === branch)!
  const mk = monthKey(year, month)

  // Load receipts from server
  async function loadReceipts() {
    setLoading(true)
    try {
      const res = await fetch(`/api/receipts?branch=${branch}&month=${mk}`)
      const data = await res.json()
      if (Array.isArray(data)) setReceipts(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { loadReceipts() }, [branch, year, month])

  // Summary for tab badges
  function branchSummary(b: string) {
    const list = receipts.filter(r => r.branch === b && r.month === mk)
    return { total: list.reduce((s, r) => s + (r.amount || 0), 0), count: list.length }
  }

  // Vendor grouping
  const vendorMap: Record<string, Receipt[]> = {}
  receipts.forEach(r => {
    const v = r.vendor || '기타'
    if (!vendorMap[v]) vendorMap[v] = []
    vendorMap[v].push(r)
  })
  const vendorEntries = Object.entries(vendorMap).sort((a, b) =>
    b[1].reduce((s, r) => s + r.amount, 0) - a[1].reduce((s, r) => s + r.amount, 0)
  )

  const total = receipts.reduce((s, r) => s + (r.amount || 0), 0)
  const topVendor = vendorEntries[0]

  async function processImage(file: File) {
    const pid = Date.now() + Math.random() + ''
    setProcessing(p => [...p, { id: pid, name: file.name }])

    // Convert to base64
const base64 = await new Promise<string>(res => {
      const canvas = document.createElement('canvas')
      const img = new Image()
      img.onload = () => {
        const max = 1024
        let w = img.width, h = img.height
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max }
          else { w = Math.round(w * max / h); h = max }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        res(canvas.toDataURL('image/jpeg', 0.7).split(',')[1])
      }
      img.src = URL.createObjectURL(file)
    })
    const thumbUrl = await new Promise<string>(res => {
      const r2 = new FileReader()
      r2.onload = e => res(e.target!.result as string)
      r2.readAsDataURL(file)
    })

    try {
      // Call server API route (API key stays server-side)
      const aiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type || 'image/jpeg' }),
      })
      const parsed = await aiRes.json()
      if (parsed.error) throw new Error(parsed.error)

      let targetMonth = mk
      if (parsed.date?.match(/^\d{4}-\d{2}/)) {
        const [y, m] = parsed.date.split('-')
        targetMonth = `${y}-${m}`
      }

      const receipt = {
        branch,
        month: targetMonth,
        vendor: parsed.vendor || '기타',
        store: parsed.store || parsed.vendor || '알 수 없음',
        amount: Number(parsed.amount) || 0,
        date: parsed.date || '',
        category: parsed.category || '기타',
        items: parsed.items || '',
        thumb: thumbUrl,
      }

      // Save to Firestore via API
      const saveRes = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receipt),
      })
      const { id } = await saveRes.json()
      setReceipts(prev => [...prev, { ...receipt, id }])
    } catch (e) {
      // Save as unknown
      const fallback = {
        branch, month: mk,
        vendor: '미분류', store: file.name.replace(/\.[^.]+$/, ''),
        amount: 0, date: '', category: '기타', items: 'AI 인식 실패', thumb: thumbUrl,
      }
      const saveRes = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallback),
      })
      const { id } = await saveRes.json()
      setReceipts(prev => [...prev, { ...fallback, id }])
    }

    setProcessing(p => p.filter(x => x.id !== pid))
  }

  async function deleteReceipt(id: string) {
    await fetch(`/api/receipts?id=${id}`, { method: 'DELETE' })
    setReceipts(prev => prev.filter(r => r.id !== id))
  }

  function toggleVendor(v: string) {
    setCollapsed(c => ({ ...c, [`${branch}_${v}`]: !c[`${branch}_${v}`] }))
  }

  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', color: '#e8edf4', fontFamily: "'Noto Sans KR', sans-serif", padding: '18px 16px 60px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        .receipt-row:hover { background: #1e2530 !important; }
        .receipt-row:hover .del-btn { opacity: 1 !important; }
        .branch-tab { transition: all 0.2s; cursor: pointer; }
        .upload-zone:hover { border-color: ${branchInfo.accent} !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#6a7585', letterSpacing: 2 }}>RECEIPT MGR</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
            style={{ background: '#161b22', border: '1px solid #2a3040', color: '#e8edf4', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 15 }}>‹</button>
          <span style={{ fontFamily: 'Space Mono', fontSize: 13, minWidth: 100, textAlign: 'center' }}>{year}년 {MONTHS[month]}</span>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
            style={{ background: '#161b22', border: '1px solid #2a3040', color: '#e8edf4', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 15 }}>›</button>
        </div>
      </div>

      {/* Branch tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {BRANCHES.map(b => {
          const isActive = branch === b.key
          return (
            <div key={b.key} className="branch-tab" onClick={() => setBranch(b.key)}
              style={{ padding: '14px 10px', borderRadius: 14, border: `2px solid ${isActive ? b.accent : '#2a3040'}`, background: isActive ? b.bg : '#161b22', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: isActive ? b.accent : '#e8edf4', marginBottom: 3 }}>{b.label}</div>
              <div style={{ fontSize: 11, color: '#6a7585' }}>
                {fmt(receipts.filter(r => r.branch === b.key).reduce((s,r) => s+r.amount,0))} · {receipts.filter(r => r.branch === b.key).length}건
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: '총 지출', value: fmt(total), sub: `${receipts.length}건` },
          { label: '최다 거래처', value: topVendor?.[0] || '-', sub: topVendor ? fmt(topVendor[1].reduce((s,r)=>s+r.amount,0)) : '-', small: true },
          { label: '거래처 수', value: vendorEntries.length, sub: '이번 달' },
        ].map((c, i) => (
          <div key={i} style={{ background: '#161b22', border: '1px solid #2a3040', borderRadius: 12, padding: '14px 12px' }}>
            <div style={{ fontSize: 10, color: '#6a7585', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{c.label}</div>
            <div style={{ fontFamily: c.small ? 'Noto Sans KR' : 'Space Mono', fontSize: c.small ? 12 : 15, fontWeight: 700, color: branchInfo.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.value}</div>
            <div style={{ fontSize: 10, color: '#6a7585', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Upload zone */}
      <div className="upload-zone"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).forEach(processImage) }}
        style={{ border: `2px dashed ${drag ? branchInfo.accent : '#2a3040'}`, borderRadius: 14, padding: '26px 16px', textAlign: 'center', cursor: 'pointer', background: drag ? branchInfo.bg : '#161b22', marginBottom: 20, transition: 'all 0.2s' }}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { Array.from(e.target.files || []).forEach(processImage); e.target.value = '' }} />
        <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
        <div style={{ fontSize: 13, color: '#6a7585', lineHeight: 1.7 }}>
          <strong style={{ color: '#e8edf4' }}>{branchInfo.label} 영수증 사진 업로드</strong><br />
          AI가 거래처·금액·날짜를 자동 인식합니다
        </div>
      </div>

      {/* Processing indicators */}
      {processing.map(p => (
        <div key={p.id} style={{ background: '#161b22', border: `1px solid ${branchInfo.accent}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 20, height: 20, border: `2px solid #2a3040`, borderTopColor: branchInfo.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div><strong style={{ fontSize: 13, display: 'block', marginBottom: 1 }}>AI 인식 중...</strong><span style={{ fontSize: 11, color: '#6a7585' }}>{p.name}</span></div>
        </div>
      ))}

      {/* Vendor groups */}
      {loading && <div style={{ textAlign: 'center', color: '#6a7585', padding: 32, fontSize: 13 }}>불러오는 중...</div>}
      {!loading && receipts.length === 0 && processing.length === 0 && (
        <div style={{ textAlign: 'center', color: '#6a7585', padding: 32, fontSize: 13, lineHeight: 2 }}>
          이달 {branchInfo.label} 영수증이 없습니다<br />사진을 업로드해 시작하세요
        </div>
      )}

      {vendorEntries.map(([vendor, list]) => {
        const vTotal = list.reduce((s, r) => s + r.amount, 0)
        const isOpen = !collapsed[`${branch}_${vendor}`]
        const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        return (
          <div key={vendor} style={{ marginBottom: 14 }}>
            <div onClick={() => toggleVendor(vendor)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1e2530', borderRadius: isOpen ? '10px 10px 0 0' : 10, border: '1px solid #2a3040', borderBottom: isOpen ? 'none' : '1px solid #2a3040', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: branchInfo.accent }} />
                {vendor}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Space Mono', fontSize: 13, fontWeight: 700, color: branchInfo.accent }}>
                <span style={{ fontSize: 11, color: '#6a7585', fontFamily: 'Noto Sans KR', fontWeight: 400 }}>{list.length}건</span>
                {fmt(vTotal)}
                <span style={{ fontSize: 11, color: '#6a7585', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ border: '1px solid #2a3040', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                {sorted.map(r => (
                  <div key={r.id} className="receipt-row" style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #2a3040', position: 'relative', transition: 'background 0.15s' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 7, overflow: 'hidden', background: '#1e2530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {r.thumb ? <img src={r.thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧾'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{r.store || r.vendor}</div>
                      <div style={{ fontSize: 11, color: '#6a7585', display: 'flex', gap: 8 }}>
                        <span style={{ background: '#1e2530', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>{r.category}</span>
                        <span>{r.items}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Space Mono', fontSize: 13, fontWeight: 700, color: branchInfo.accent }}>{r.amount ? fmt(r.amount) : '-'}</div>
                      <div style={{ fontSize: 10, color: '#6a7585', marginTop: 2 }}>{r.date}</div>
                    </div>
                    <button className="del-btn" onClick={() => deleteReceipt(r.id)}
                      style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: '#6a7585', cursor: 'pointer', fontSize: 11, opacity: 0, padding: '2px 4px', transition: 'opacity 0.2s' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Vendor bar chart */}
      {vendorEntries.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: 2, color: '#6a7585', textTransform: 'uppercase', marginBottom: 12 }}>거래처별 지출</div>
          {vendorEntries.map(([name, list]) => {
            const amt = list.reduce((s, r) => s + r.amount, 0)
            const pct = vendorEntries[0][1].reduce((s,r)=>s+r.amount,0) > 0 ? amt / vendorEntries[0][1].reduce((s,r)=>s+r.amount,0) * 100 : 0
            return (
              <div key={name} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px', gap: 10, alignItems: 'center', marginBottom: 9 }}>
                <div style={{ fontSize: 11, color: '#6a7585', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ background: '#1e2530', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${pct.toFixed(1)}%`, height: '100%', background: branchInfo.accent, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontFamily: 'Space Mono', fontSize: 11, textAlign: 'right' }}>{fmt(amt)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
