# RSS監視AIエージェント プロジェクトメモリ

## プロジェクト概要

このプロジェクトは、RSS監視AIエージェントを構築します。

### 目的
- 登録されたWebサイトのRSSフィードを定期的に監視
- 新着記事を検出し、AIで要約
- 要約をSlackに自動投稿

## システムフロー

### 処理ステップ

**ステップ1: RSS新着記事取得**
- 対象サイトのRSSフィードを取得
- 履歴JSONファイルと比較して新着記事のみ抽出
- 初回実行時は最新記事のみを対象
- 出力: 新着記事の配列（タイトル、リンク、本文等）

**ステップ2: 記事要約生成**
- AI Agentを使用して各記事を要約
- 環境変数でプロンプト・形式・長さをカスタマイズ可能
- mcpサーバーをvercel ai sdkのAgentインスタンスのtoolとして登録
- 出力: 要約テキスト

**ステップ3: Slack投稿**
- Slack Incoming Webhooksで投稿
- 記事ごとに個別投稿
- エラー時も同じWebhookで通知

### スケジューラー実行
```typescript
// 6時間ごとにワークフローを実行
cron.schedule('0 */6 * * *', async () => {
  // 要約処理
});
```

## 技術仕様

### 使用フレームワーク
- **Node.js**: >= 22.14.0

### 主要依存パッケージ
`package.json` ファイルを参照すること

### typescriptコンパイラ設定
`tsconfig.json` ファイルを参照すること

### AIモデル設定
- **使用モデル**: Anthropic Claude
- **APIキー環境変数**: `ANTHROPIC_API_KEY`

## 環境変数設定

### 必須環境変数
```
ANTHROPIC_API_KEY=<既存のAPIキー>
RSS_FEED_URLS=<カンマ区切りのRSSフィードURL>
SLACK_WEBHOOK_URL=<Slack Incoming WebhookのURL>
```

### オプション環境変数
```
SUMMARY_PROMPT=<記事要約用のカスタムプロンプト>
SUMMARY_MAX_LENGTH=<要約の最大文字数>
SUMMARY_FORMAT=<要約の出力形式>
```

## データ管理

### 新着記事の判定方法
- **判定基準**: 前回チェック時からの差分
- **初回動作**: 最新の記事のみを対象
- **保存方法**: ローカルJSONファイル
- **保存場所**: `data/article-history.json` (予定)

### 記事履歴のデータ構造
```typescript
{
  "feedUrl": string,
  "lastChecked": string (ISO 8601),
  "articles": [
    {
      "id": string,
      "title": string,
      "link": string,
      "publishedDate": string
    }
  ]
}
```

## スケジューラー仕様

- **実行間隔**: 6時間ごと
- **実装方法**: アプリケーション内部スケジューラー (node-cron)
- **Cron式**: `0 */6 * * *` (毎6時間の0分に実行)

## エラーハンドリング

### RSSフィード取得失敗
- Slackに通知
- エラー内容と対象URLを含める

### 要約生成失敗
- Slackに通知
- エラー内容と対象記事のURLを含める

### 通知形式
- 個別エラーごとにSlack投稿
- エラーメッセージはユーザーが確認しやすい形式

## 実装ファイル構成

```
src/
├── web-summarizer/
│   ├── application/
│   │   ├── web-summarize-service.ts     # メインワークフロー（3ステップを統合）
│   │   └── article-repository.ts        # 記事履歴管理を行うためのインターフェース
│   ├── agent/
│   │   └── summarizer-agent.ts          # 記事要約エージェント
│   └── infrastructure/
│       └── json-article-repository.ts   # 記事履歴管理を行うためのインターフェースの実装
└── index.ts                             # アプリエントリーポイント
data/
└── article-history.json                 # 記事履歴保存ファイル
```

## 参考情報

### 特記事項
- 環境変数からAPIキーを自動検出

## 設計上の決定事項

1. **ワークフロー構成**: 3ステップ（RSS取得→AI要約→Slack投稿）
2. **AI使用箇所**: 要約処理のみ（コスト効率化）
3. **記事の一意性判定**: RSSアイテムの`guid`または`link`を使用
4. **履歴保存フォーマット**: JSON形式、人間が読みやすい構造
5. **エラー通知**: すべてのエラーをSlackに集約
6. **スケジューラー**: node-cron
7. **実行方法**: アプリケーション内蔵型（外部cronジョブ不要）

## 実装ルール

### Kent BeckのTDD（テスト駆動開発）
- **Red-Green-Refactorサイクル**を実践
- **実装前にテストを作成**: 機能実装する前に、まずテストを書いて失敗させる（Red）
- **最小限の実装で通す**: テストが通る最小限の実装を行う（Green）  
- **リファクタリング**: コードの品質を向上させる（Refactor）

### 関数志向

- 状態管理が必要か？必要であればクラスで実装する
- 状態管理が不要であれば関数で実装する

### Linterの使用

- ESLintがセットアップされているのでそれを使用する
- ファイルをアップデートするごとにLinterで問題がないか確認する
- Linterの設定はeslint.config.tsに記載されている

---
