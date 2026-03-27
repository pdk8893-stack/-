# 영수증 관리 앱

용인점·오산점 월별 영수증 AI 자동 인식 정리 앱

## 기술 스택

- **Next.js 14** (App Router)
- **Anthropic Claude API** — 영수증 이미지 AI 분석 (서버에서 호출, API 키 안전)
- **Firebase Firestore** — 영수증 데이터 영구 저장
- **Vercel** — 배포

---

## 배포 방법 (Vercel)

### 1단계 — GitHub에 코드 올리기

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/receipt-app.git
git push -u origin main
```

### 2단계 — Vercel 연결

1. https://vercel.com 접속 → **Add New Project**
2. GitHub 저장소 선택
3. Framework: **Next.js** (자동 감지)
4. **Environment Variables** 탭에서 아래 값들 입력

### 3단계 — 환경변수 입력 (Vercel Dashboard)

| 변수명 | 값 | 어디서 |
|--------|-----|--------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | https://console.anthropic.com |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 콘솔 값 | Firebase 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 콘솔 값 | Firebase 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 콘솔 값 | Firebase 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase 콘솔 값 | Firebase 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 콘솔 값 | Firebase 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 콘솔 값 | Firebase 프로젝트 설정 |
| `FIREBASE_ADMIN_PROJECT_ID` | 프로젝트 ID | Firebase 프로젝트 설정 |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | 서비스 계정 이메일 | Firebase → 프로젝트 설정 → 서비스 계정 |
| `FIREBASE_ADMIN_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\n..."` | Firebase 서비스 계정 JSON |

### Firebase 서비스 계정 키 발급 방법

1. Firebase 콘솔 → 프로젝트 설정 → **서비스 계정** 탭
2. **새 비공개 키 생성** 버튼 클릭 → JSON 파일 다운로드
3. JSON 파일에서:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (따옴표 포함해서 그대로 붙여넣기)

### Firestore 보안 규칙 설정

Firebase 콘솔 → Firestore → 규칙 탭에서:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /receipts/{id} {
      allow read, write: if true; // 운영 환경에서는 인증 추가 권장
    }
  }
}
```

### 4단계 — 배포

Vercel에서 **Deploy** 버튼 클릭 → 완료!

---

## 로컬 개발

```bash
# 의존성 설치
npm install

# .env.local 파일 생성 후 환경변수 입력
cp .env.example .env.local

# 개발 서버 시작
npm run dev
# → http://localhost:3000
```

---

## 기능

- 📷 영수증 사진 업로드 (드래그앤드롭 또는 탭)
- 🤖 AI 자동 인식: 거래처명, 금액, 날짜, 카테고리, 품목
- 🏢 용인점 / 오산점 지점 분리
- 📅 월별 전환
- 📦 거래처별 그룹핑 (금액 내림차순)
- 📊 거래처별 지출 바 차트
- 🗑️ 영수증 삭제
