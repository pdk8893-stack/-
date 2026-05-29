import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 없음' }, { status: 500 })

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType || 'image/jpeg', data: imageBase64 } },
              { text: `이 영수증을 분석해서 아래 JSON 형식으로만 응답해. 마크다운 코드블록 없이 순수 JSON만.\n{"vendor":"거래처명","store":"상호명","amount":숫자,"date":"YYYY-MM-DD","category":"식재료","items":"품목요약"}` }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        }),
      }
    )

    const data = await response.json()
    console.log('Gemini response:', JSON.stringify(data).slice(0, 500))

    if (!response.ok) {
      console.error('Gemini API error:', data)
      return NextResponse.json({ error: data.error?.message || 'Gemini 오류' }, { status: 500 })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('Gemini text:', text)

    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e: any) {
    console.error('Analyze error:', e.message)
    return NextResponse.json({ error: e.message || 'AI 인식 실패' }, { status: 500 })
  }
}
