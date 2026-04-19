# 負載與 Firestore 讀寫驗證清單

對齊「嚴格情境」假設（約 100 人在線、最多約 30 位教練同開儀表板）時，用下列步驟驗證實際曲線。

## 1. Firebase Console 監控

1. 開啟 [Firebase Console](https://console.firebase.google.com/) → 選專案。  
2. **Firestore** → **使用量**（或 **Usage**）：觀察讀取、寫入、刪除次數與趨勢。  
3. **Authentication**：確認同時登入量無異常錯誤。  
4. 若已啟用 **Blaze** 方案：在 **Billing** 檢視 Firestore 費用是否與預期一致。

## 2. 手動「多開教練儀表板」

1. 準備 2～3 個測試帳號（皆為同隊 **教練** 角色）。  
2. 各用不同瀏覽器設定檔或無痕視窗登入，同時開啟 **教練主頁**（`CoachDashboard`）。  
3. 另開一視窗以球員身分新增／更新訓練紀錄數次。  
4. 觀察：儀表板是否即時更新、主控台讀取次數是否陡升後趨於穩定。

## 3. 與程式假設對照

- [CoachDashboard.tsx](../src/components/CoachDashboard.tsx) 目前為 **5 條**主要 `onSnapshot`（users、合併後 training_logs、instructions、completions、notifications），外加 **每 45 秒**一次本月活躍 `getDocs`。  
- 若 30 教練同時在線仍偏高，下一步為 [firestore-aggregates.md](firestore-aggregates.md) 的 `aggregates/dashboard` + Cloud Functions。

## 4.（可選）自動化壓力測試

專案未內建 CI 壓測腳本。若需長期回歸，可另建小工具使用 **Admin SDK** 模擬多 session（注意勿將 service account 金鑰提交至公開 repo）。
