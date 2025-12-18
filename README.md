# OpenAI Video Tool (Cloudflare Pages)

OpenAI **Videos API**(예: `POST /v1/videos`) 명세를 기반으로, 프롬프트(및 선택 이미지 레퍼런스)로 비디오 생성 작업을 만들고 상태를 조회한 뒤 MP4를 다운로드할 수 있는 **웹 UI**입니다.

Cloudflare Pages에 **정적 자산(`public/`) + Pages Functions(`functions/`)** 형태로 배포할 수 있도록 구성되어 있습니다.

## 구성

- 정적 프론트엔드: `public/`
  - `public/index.html` / `public/app.js` / `public/styles.css`
  - 생성 요청, 작업 목록(로컬 저장), 상태 폴링, MP4 다운로드/미리보기, 리믹스 기능 제공
- 서버 프록시(API): `functions/`
  - 브라우저에서 OpenAI API를 직접 호출하지 않고(CORS 이슈 회피), Pages Functions가 OpenAI API로 요청을 프록시합니다.
  - OpenAI API Key는 **사용자가 웹페이지에서 입력**하며, 서버(Cloudflare)에 별도 환경 변수로 저장하지 않습니다.

## 사용 방법

1. 웹페이지에서 `OpenAI API Key` 입력 (브라우저 로컬 저장소에만 저장됨)
2. 프롬프트 입력 → 비디오 생성
3. 완료되면 MP4 다운로드 또는 미리보기 로드

> “내 작업” 목록은 브라우저 로컬 저장소에만 저장되며, 사용자 간 공유되지 않습니다.

## Cloudflare Pages 배포 방법

1. 이 저장소를 Cloudflare Pages에 연결합니다.
2. Build 설정:
   - **Build command**: 비워두기
   - **Build output directory**: `public`
3. 배포 후 생성된 도메인으로 접속하여 사용

## 로컬 개발(선택)

> 로컬에서 Pages Functions까지 포함해서 테스트하려면 Wrangler를 사용하세요.

1. Node.js 18+ 설치
2. 실행

```bash
npx wrangler pages dev public
```

## 제공 API 엔드포인트

UI는 아래 엔드포인트만 사용합니다.

- `POST /api/videos` → OpenAI `POST /v1/videos`
- `GET /api/videos/:videoId` → OpenAI `GET /v1/videos/{video_id}`
- `POST /api/videos/:videoId/remix` → OpenAI `POST /v1/videos/{video_id}/remix`
- `GET /api/videos/:videoId/content` → OpenAI `GET /v1/videos/{video_id}/content`

## 주의사항

- “내 작업” 목록은 브라우저 로컬 저장소에만 저장됩니다. 서버에 작업 목록을 저장하지 않습니다.
- OpenAI API 키는 브라우저 로컬 저장소에 저장되며, `/api/*` 호출 시 `X-OpenAI-Api-Key` 헤더로 Functions에 전달됩니다.
- 이 프로젝트는 OpenAI API 키를 서버에 저장하지 않습니다.
