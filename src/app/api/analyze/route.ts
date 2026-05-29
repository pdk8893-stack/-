import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY 없음' }, { status: 500 })

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${imageBase64}` } },
            { type: 'text', text: `이 영수증을 분석해서 아래 JSON 형식으로만 응답해. 마크다운 없이 순수 JSON만.\n{"vendor":"거래처명","store":"상호명","amount":숫자,"date":"YYYY-MM-DD","category":"식재료|음료|소모품|주방용품|세제·위생|포장재|기타 중 하나","items":"품목요약"}` }
          ]
        }],
        max_tokens: 300,
      }),
    })

    const data = await response.json()
    console.log('OpenRouter response:', JSON.stringify(data).slice(0, 500))

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'OpenRouter 오류' }, { status: 500 })
    }

    const text = data.choices?.[0]?.message?.content || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e: any) {
    console.error('Analyze error:', e.message)
    return NextResponse.json({ error: e.message || 'AI 인식 실패' }, { status: 500 })
  }
}
