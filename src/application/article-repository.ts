export interface Article {
  id: string;
  title: string;
  link: string;
  publishedDate: string;
}

export interface FeedHistory {
  feedUrl: string;
  lastChecked: string;
  articles: Article[];
}

export interface ArticleRepository {
  /**
   * 指定されたフィードURLの履歴を取得する
   * @param feedUrl - フィードURL
   * @returns フィード履歴。存在しない場合はnull
   */
  getFeedHistory(feedUrl: string): Promise<FeedHistory | null>;

  /**
   * フィード履歴を保存する
   * @param history - 保存するフィード履歴
   */
  saveFeedHistory(history: FeedHistory): Promise<void>;
}
