import {
  ArticleRepository,
  FeedHistory,
} from "../application/article-repository";
import * as fs from "fs/promises";
import * as path from "path";

export class JsonArticleRepository implements ArticleRepository {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async getFeedHistory(feedUrl: string): Promise<FeedHistory | null> {
    try {
      const fileContent = await fs.readFile(this.filePath, "utf-8");
      const histories: FeedHistory[] = JSON.parse(fileContent);
      const history = histories.find((h) => h.feedUrl === feedUrl);
      return history ?? null;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    }
  }

  async saveFeedHistory(history: FeedHistory): Promise<void> {
    let histories: FeedHistory[] = [];
    try {
      const fileContent = await fs.readFile(this.filePath, "utf-8");
      histories = JSON.parse(fileContent);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "ENOENT"
      ) {
        histories = [];
      } else {
        throw error;
      }
    }

    const existingIndex = histories.findIndex(
      (h) => h.feedUrl === history.feedUrl,
    );
    if (existingIndex >= 0) {
      histories[existingIndex] = history;
    } else {
      histories.push(history);
    }

    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      this.filePath,
      JSON.stringify(histories, null, 2),
      "utf-8",
    );
  }
}
