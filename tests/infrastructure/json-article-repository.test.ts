import { JsonArticleRepository } from "../../src/infrastructure/json-article-repository";
import { FeedHistory } from "../../src/application/article-repository";
import * as fs from "fs/promises";
import * as path from "path";

describe("JsonArticleRepository", () => {
  const testDataDir = path.join(__dirname, "../../data/test");
  const testFilePath = path.join(testDataDir, "article-history.json");
  let repository: JsonArticleRepository;

  beforeEach(async () => {
    await fs.mkdir(testDataDir, { recursive: true });
    repository = new JsonArticleRepository(testFilePath);
  });

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true });
  });

  describe("getFeedHistory", () => {
    it("存在しないフィードURLの履歴を取得した場合、nullを返す", async () => {
      // Given
      await fs.writeFile(testFilePath, JSON.stringify([]), "utf-8");

      // When
      const result = await repository.getFeedHistory(
        "https://example.com/feed",
      );

      // Then
      expect(result).toBeNull();
    });

    it("保存されたフィード履歴を取得できる", async () => {
      // Given
      const history: FeedHistory = {
        feedUrl: "https://example.com/feed",
        lastChecked: "2025-01-01T00:00:00Z",
        articles: [
          {
            id: "article-1",
            title: "Test Article",
            link: "https://example.com/article-1",
            publishedDate: "2025-01-01T00:00:00Z",
          },
        ],
      };
      const data: FeedHistory[] = [history];
      await fs.writeFile(testFilePath, JSON.stringify(data), "utf-8");

      // When
      const result = await repository.getFeedHistory(
        "https://example.com/feed",
      );

      // Then
      expect(result).toEqual(history);
    });

    it("JSONファイルが存在しない場合、nullを返す", async () => {
      // When
      const result = await repository.getFeedHistory(
        "https://example.com/feed",
      );

      // Then
      expect(result).toBeNull();
    });
  });

  describe("saveFeedHistory", () => {
    it("フィード履歴をJSONファイルに保存できる", async () => {
      // Given
      const history: FeedHistory = {
        feedUrl: "https://example.com/feed",
        lastChecked: "2025-01-01T00:00:00Z",
        articles: [],
      };

      // When
      await repository.saveFeedHistory(history);

      // Then
      const fileContent = await fs.readFile(testFilePath, "utf-8");
      const savedData: FeedHistory[] = JSON.parse(fileContent);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toEqual(history);
    });

    it("同じフィードURLの履歴を上書きできる", async () => {
      // Given
      const history1: FeedHistory = {
        feedUrl: "https://example.com/feed",
        lastChecked: "2025-01-01T00:00:00Z",
        articles: [],
      };
      const history2: FeedHistory = {
        feedUrl: "https://example.com/feed",
        lastChecked: "2025-01-02T00:00:00Z",
        articles: [
          {
            id: "article-1",
            title: "New Article",
            link: "https://example.com/article-1",
            publishedDate: "2025-01-02T00:00:00Z",
          },
        ],
      };
      const initialData: FeedHistory[] = [history1];
      await fs.writeFile(testFilePath, JSON.stringify(initialData), "utf-8");

      // When
      await repository.saveFeedHistory(history2);

      // Then
      const fileContent = await fs.readFile(testFilePath, "utf-8");
      const savedData: FeedHistory[] = JSON.parse(fileContent);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toEqual(history2);
    });

    it("複数のフィードURLの履歴を保存できる", async () => {
      // Given
      const history1: FeedHistory = {
        feedUrl: "https://example.com/feed1",
        lastChecked: "2025-01-01T00:00:00Z",
        articles: [],
      };
      const history2: FeedHistory = {
        feedUrl: "https://example.com/feed2",
        lastChecked: "2025-01-02T00:00:00Z",
        articles: [],
      };

      // When
      await repository.saveFeedHistory(history1);
      await repository.saveFeedHistory(history2);

      // Then
      const fileContent = await fs.readFile(testFilePath, "utf-8");
      const savedData: FeedHistory[] = JSON.parse(fileContent);
      expect(savedData).toHaveLength(2);
      expect(
        savedData.find((h) => h.feedUrl === "https://example.com/feed1"),
      ).toEqual(history1);
      expect(
        savedData.find((h) => h.feedUrl === "https://example.com/feed2"),
      ).toEqual(history2);
    });
  });
});
