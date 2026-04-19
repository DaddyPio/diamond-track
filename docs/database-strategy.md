# 資料庫策略與 Firebase 替代方案

本文件對應專案決策：在維持現有 Firestore 的前提下，釐清優先順序、盤點使用情形，並收斂未來若遷移時的候選方案與程式結構方向。

---

## 1. 優先順序（本專案假設）

依 Diamond Track（球隊管理、教練／球員角色、Cloudflare Pages 部署）特性，建議權重如下：

1. **維運與開發成本**：單人或小團隊、前端為主，優先避免自建長駐後端與複雜維運。
2. **即時與讀取成本**：儀表板與名單等多處使用即時監聽，需控制訂閱數量與計費。
3. **查詢與報表**：若未來需要大量跨表報表、複雜 JOIN，再評估 SQL 類後端。

法遵與「資料必須落地某區域」若成為硬需求，再單獨拉高該項權重。

---

## 1.1 嚴格容量假設（內部設計目標）

當不確定實際流量時，可用下列**偏保守**假設做成本與讀取設計（之後可用監控數據替換）：

| 項目 | 採用值 | 說明 |
|------|--------|------|
| 同時在線 | **100 人** | 與產品討論對齊的數量級 |
| 同時開最重畫面 | **最多 30 位教練** 同時在 [CoachDashboard.tsx](../src/components/CoachDashboard.tsx) | 讀取成本主要由「多路 `onSnapshot`」主導；30 為保守上界 |
| 「每分鐘約 3 次更新」 | **全隊可見資料平均每分鐘約 3 次**會讓多個 listener 跟著更新的變更 | 用於評估 fan-out，而非假設每人各寫 3 次 DB |

在此假設下仍建議 **維持 Firebase**；瓶頸在 **listener 數與查詢形狀**，見下文教練儀表板優化與 [docs/firestore-aggregates.md](firestore-aggregates.md)、[docs/load-testing-checklist.md](load-testing-checklist.md)。

---

## 2. Firestore 盤點

### 2.1 Collections（與 [firestore.rules](firestore.rules) 一致）

| Collection | 用途（摘要） |
|------------|----------------|
| `users` | 使用者／球員／教練檔案，`teamId` 與 `role` |
| `teams` | 球隊、評分標準等 |
| `training_logs` | 訓練紀錄與回饋 |
| `instructions` | 教練指示 |
| `instruction_completions` | 指示完成紀錄 |
| `notifications` | 通知 |
| `performance_records` | 比賽／測驗成績 |
| `attendance` | 出席 |

開發用：`test/connection`（[src/firebase.ts](src/firebase.ts) 連線測試）不屬於業務資料模型。

### 2.2 `onSnapshot` 使用處與是否「必要」為即時

| 位置 | 訂閱內容 | 即時是否強需求 | 備註 |
|------|-----------|----------------|------|
| [src/AuthContext.tsx](src/AuthContext.tsx) | `users/{uid}` | 高 | 登入後身分／隊伍變更應反映 |
| [src/App.tsx](src/App.tsx) | `teams/{teamId}` | 中 | Logo／隊名更新；可改為手動刷新 |
| [src/components/CoachDashboard.tsx](src/components/CoachDashboard.tsx) | users、**單一** training_logs 訂閱（合併週／最近紀錄）、本月活躍改輪詢 `getDocs`、instructions、completions、notifications | 高（教練儀表板） | 已縮減 `training_logs` 的 `onSnapshot` 重疊；仍為熱點，可再導入彙總文件 |
| [src/components/TeamRoster.tsx](src/components/TeamRoster.tsx) | users、team doc、training_logs、attendance | 中高 | 名單與近況 |
| [src/components/Attendance.tsx](src/components/Attendance.tsx) | attendance | 中 | 點名當日可改一次載入 + 寫入後刷新 |
| [src/components/PerformanceEntry.tsx](src/components/PerformanceEntry.tsx) | performance_records | 中 | 多人同時編輯少見時可降級 |
| [src/components/TrainingHistory.tsx](src/components/TrainingHistory.tsx) | training_logs | 低 | 歷史列表多半可改 `getDocs` + 手動刷新 |
| [src/components/PlayerManagement.tsx](src/components/PlayerManagement.tsx) | users | 中 | 待審核狀態即時較方便 |
| [src/components/RatingStandards.tsx](src/components/RatingStandards.tsx) | teams | 中 | 編輯頻率低 |
| [src/components/PlayerProfile.tsx](src/components/PlayerProfile.tsx) | teams | 低 | 與隊伍設定連動 |

以下檔案曾 import `onSnapshot` 但實際以 `getDocs` 為主（可視為技術債，之後可刪未使用 import）：

- [src/components/PlayerDashboard.tsx](src/components/PlayerDashboard.tsx)
- [src/components/Instructions.tsx](src/components/Instructions.tsx)

### 2.3 安全規則要點

規則以 `sameTeam(teamId)`、`isCoach()`、`isOwner(uid)` 為核心，與未來 Postgres RLS「依 `team_id` 限制列」概念對齊。完整模型見 [firestore.rules](firestore.rules) 開頭註解。

---

## 3. 候選方案收斂（1～2 個）

依上述優先順序（維運 > 即時／成本 > 報表）：

| 候選 | 適合情境 | 與現況差距 |
|------|-----------|------------|
| **維持 Firebase（Firestore + Auth）** | 現況已上線、模型已與規則綁定 | 成本優化靠減少訂閱、索引與快取 |
| **Supabase（Postgres + Auth + Realtime）** | 未來報表／關聯查詢變重、願意做一次中大型遷移 | 表結構 + RLS + 即時頻道取代 `onSnapshot` |

**短結論**：短期預設 **繼續使用 Firebase**；若 6～12 個月內出現「複雜報表、大量 JOIN、或 Firestore 查詢／計費成為主瓶頸」，再以 **Supabase** 為首選遷移目標，並搭配「API 或 Row Level Security」重做權限。

「純 Postgres + 自建 API」保留為需要完全自控主機與計費時的選項，維運成本較高。

---

## 4. 資料存取層（已開始）

為降低未來換後端的耦合，新增 [src/data/](src/data/)：

- [src/data/collectionNames.ts](src/data/collectionNames.ts)：集中 collection 名稱常數。
- [src/data/user.ts](src/data/user.ts)：`subscribeToUserDocument`（使用者文件訂閱）。
- [src/data/team.ts](src/data/team.ts)：`subscribeToTeamDocument`（球隊文件訂閱）。

[AuthContext.tsx](src/AuthContext.tsx) 與 [App.tsx](src/App.tsx) 已改為透過上述模組訂閱，後續遷移可逐步把各 component 的 Firestore 呼叫移入 `src/data/*`，避免二十餘個元件直接依賴 SDK 細節。

---

## 5. 後續建議工作（未排程）

1. 將 `CoachDashboard`、`TeamRoster` 等高訂閱元件分批封裝進 `src/data/`。
2. 對「低即時需求」畫面改為 `getDocs` 或手動刷新，降低讀取與連線數。
3. 若選定 Supabase：先畫 ER 圖與 RLS 規則對照表，再雙寫或批次遷移。
