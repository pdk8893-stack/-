import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY 없음' }, { status: 500 })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mediaType || 'image/jpeg',
                    data: imageBase64,
                  },
                },
                {
                  text: `이 영수증을 분석해서 JSON으로만 응답해. 마크다운 없이 순수 JSON만.\n{\n  "vendor": "거래처명",\n  "store": "상호명",\n  "amount": 숫자,\n  "date": "YYYY-MM-DD",\n  "category": "식재료|음료|소모품|주방용품|세제·위생|포장재|기타 중 하나",\n  "items": "주요 품목 요약 (최대 25자)"\n}\n영수증이 아니면 {"error":"영수증 아님"}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
        }),
      }
    )

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Gemini 오류' }, { status: 500 })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e: any) {
    console.error('Analyze error:', e)
    return NextResponse.json({ error: e.message || 'AI 인식 실패' }, { status: 500 })
  }
}
