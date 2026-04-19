<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/00e51c7c-23a1-4c5e-8e3b-4e9bdecb77fb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Cloudflare Pages

1. Login to Cloudflare:
   `npx wrangler login`
2. Build and deploy:
   `npm run deploy:cf`
3. (Optional) Local preview with Cloudflare runtime:
   `npm run preview:cf`

### Build settings for Cloudflare dashboard (if you connect this repo)

- Build command: `npm run build`
- Build output directory: `dist`

### Required environment variables

- Add `GEMINI_API_KEY` in Cloudflare Pages project settings (`Settings > Environment variables`).

## User manual

- 可列印約 10 頁 A4 的 HTML 手冊：[docs/Diamond-Track-使用手冊.html](docs/Diamond-Track-使用手冊.html)（瀏覽器開啟後可「列印 → 另存 PDF」）。

## Database strategy

- [docs/database-strategy.md](docs/database-strategy.md): Firestore 盤點、替代方案、嚴格容量假設、資料存取層方向。  
- [docs/firestore-aggregates.md](docs/firestore-aggregates.md): 可選的 `teams/{teamId}/aggregates/*` 彙總設計。  
- [docs/load-testing-checklist.md](docs/load-testing-checklist.md): 監控與多開驗證步驟。
