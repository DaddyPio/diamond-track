# Firestore 彙總文件（可選優化）

目的：讓「多人同時開教練儀表板」時，盡量只訂閱 **少量小文件**，而不是多條大範圍 `collection` 查詢，以降低讀取與 listener fan-out。

## 建議路徑

- 文件：`teams/{teamId}/aggregates/dashboard`
- 可選第二份：`teams/{teamId}/aggregates/instruction_stats`（若指示完成度也成熱點）

## `dashboard` 建議欄位（範例）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `updatedAt` | timestamp | 最後更新時間 |
| `activePlayersThisMonth` | number | 本月至少一筆訓練紀錄的球員數 |
| `recentLogSummary` | map 或 array | 最近數日訓練摘要（已由後端或 Functions 聚合） |
| `weeklyCountsByDay` | map | 鍵為 `yyyy-MM-dd`，值為當日筆數（供週圖表） |

實際欄位可依 UI 需求裁剪；原則是 **單次讀取即可渲染儀表板主區塊**。

## 誰負責寫入

1. **Cloud Functions（推薦）**：`training_logs` 寫入觸發 `onCreate`／`onUpdate`，重算後寫入 `aggregates/dashboard`（可 debounce 或每 N 秒合併一次）。  
2. **過渡期**：維持現有前端直寫 `training_logs`，儀表板仍用合併 listener + 輪詢；待 Functions 上線後，教練端改為 **單一 `onSnapshot(doc(..., 'aggregates', 'dashboard'))`**。

## 安全規則

[firestore.rules](../firestore.rules) 已加入 `teams/{teamId}/aggregates/{docId}`：同隊可讀、教練可寫。若僅由 Functions 寫入，可再改為 **拒絕 client 寫入**、只允許 service account（需 Admin SDK 與規則調整策略）。
