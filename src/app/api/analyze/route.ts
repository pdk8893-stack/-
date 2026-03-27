import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `이 영수증을 분석해서 JSON으로만 응답해. 마크다운 없이 순수 JSON만.
{
  "vendor": "거래처명 (공급자/가게 공식명칭)",
  "store": "영수증에 표시된 상호명",
  "amount": 숫자(원화 합계금액, 숫자만),
  "date": "YYYY-MM-DD",
  "category": "식재료|음료|소모품|주방용품|세제·위생|포장재|기타 중 하나",
  "items": "주요 품목 요약 (최대 25자)"
}
영수증이 아니면 {"error":"영수증 아님"}`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json(parsed)
  } catch (e: any) {
    console.error('Analyze error:', e)
    return NextResponse.json({ error: e.message || 'AI 인식 실패' }, { status: 500 })
  }
}
