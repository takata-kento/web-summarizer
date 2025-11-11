import { runWorkflow } from "../../src/application/web-summarize-service";
import type { ArticleRepository } from "../../src/application/article-repository";
import { summarizeArticle } from "../../src/ai/summarizer";
import Parser from "rss-parser";

// モック設定
jest.mock("../../src/ai/summarizer");
jest.mock("rss-parser");

// グローバルfetchのモック
global.fetch = jest.fn();

describe("runWorkflow", () => {
  const mockSummarizeArticle = summarizeArticle as jest.MockedFunction<
    typeof summarizeArticle
  >;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  const mockParser = Parser as jest.MockedClass<typeof Parser>;

  let mockRepository: jest.Mocked<ArticleRepository>;
  let mockParserInstance: jest.Mocked<Parser>;
  const testWebhookUrl = "https://hooks.slack.com/services/TEST/WEBHOOK/URL";

  beforeEach(() => {
    // ArticleRepositoryのモックを作成
    mockRepository = {
      getFeedHistory: jest.fn(),
      saveFeedHistory: jest.fn(),
    };

    // RSS Parserのモックインスタンスを作成
    mockParserInstance = {
      parseURL: jest.fn(),
    } as unknown as jest.Mocked<Parser>;

    mockParser.mockImplementation(() => mockParserInstance);

    mockSummarizeArticle.mockReset();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
  });

  it("新着記事がない場合は何もしない", async () => {
    // Given: 履歴に記事が存在する
    mockRepository.getFeedHistory.mockResolvedValue({
      feedUrl: "https://example.com/feed",
      lastChecked: "2025-01-01T00:00:00Z",
      articles: [
        {
          id: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          publishedDate: "2025-01-01T00:00:00Z",
        },
      ],
    });

    // RSSフィードには既存記事のみ
    mockParserInstance.parseURL.mockResolvedValue({
      items: [
        {
          guid: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          content: "既存記事の本文",
          isoDate: "2025-01-01T00:00:00Z",
        },
      ],
    } as unknown as Parser.Output<Record<string, never>>);

    // When
    await runWorkflow(
      ["https://example.com/feed"],
      mockRepository,
      testWebhookUrl,
    );

    // Then
    expect(mockSummarizeArticle).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockRepository.saveFeedHistory).toHaveBeenCalledWith({
      feedUrl: "https://example.com/feed",
      lastChecked: expect.any(String),
      articles: [
        {
          id: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          publishedDate: "2025-01-01T00:00:00Z",
        },
      ],
    });
  });

  it("新着記事がある場合は要約を生成してSlackに投稿する", async () => {
    // Given: 履歴に1つの記事が存在
    mockRepository.getFeedHistory.mockResolvedValue({
      feedUrl: "https://example.com/feed",
      lastChecked: "2025-01-01T00:00:00Z",
      articles: [
        {
          id: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          publishedDate: "2025-01-01T00:00:00Z",
        },
      ],
    });

    // RSSフィードには既存記事と新着記事がある
    mockParserInstance.parseURL.mockResolvedValue({
      items: [
        {
          guid: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          content: "既存記事の本文",
          isoDate: "2025-01-01T00:00:00Z",
        },
        {
          guid: "article-2",
          title: "新着記事",
          link: "https://example.com/article-2",
          content: "新着記事の本文です。",
          isoDate: "2025-01-02T00:00:00Z",
        },
      ],
    } as unknown as Parser.Output<Record<string, never>>);

    mockSummarizeArticle.mockResolvedValue("新着記事の要約です。");

    // When
    await runWorkflow(
      ["https://example.com/feed"],
      mockRepository,
      testWebhookUrl,
    );

    // Then
    expect(mockSummarizeArticle).toHaveBeenCalledWith({
      title: "新着記事",
      content: "新着記事の本文です。",
      link: "https://example.com/article-2",
    });
    expect(mockFetch).toHaveBeenCalledWith(testWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "新着記事: 新着記事",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "新着記事",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "新着記事の要約です。",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "<https://example.com/article-2|記事を読む>",
            },
          },
        ],
      }),
    });
    expect(mockRepository.saveFeedHistory).toHaveBeenCalledWith({
      feedUrl: "https://example.com/feed",
      lastChecked: expect.any(String),
      articles: [
        {
          id: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          publishedDate: "2025-01-01T00:00:00Z",
        },
        {
          id: "article-2",
          title: "新着記事",
          link: "https://example.com/article-2",
          publishedDate: "2025-01-02T00:00:00Z",
        },
      ],
    });
  });

  it("初回実行時は最新の記事のみを対象とする", async () => {
    // Given: 履歴が存在しない（初回実行）
    mockRepository.getFeedHistory.mockResolvedValue(null);

    // RSSフィードには複数の記事がある
    mockParserInstance.parseURL.mockResolvedValue({
      items: [
        {
          guid: "article-1",
          title: "古い記事",
          link: "https://example.com/article-1",
          content: "古い記事の本文",
          isoDate: "2025-01-01T00:00:00Z",
        },
        {
          guid: "article-2",
          title: "最新記事",
          link: "https://example.com/article-2",
          content: "最新記事の本文です。",
          isoDate: "2025-01-02T00:00:00Z",
        },
      ],
    } as unknown as Parser.Output<Record<string, never>>);

    mockSummarizeArticle.mockResolvedValue("最新記事の要約です。");

    // When
    await runWorkflow(
      ["https://example.com/feed"],
      mockRepository,
      testWebhookUrl,
    );

    // Then: 最新記事のみが要約される
    expect(mockSummarizeArticle).toHaveBeenCalledTimes(1);
    expect(mockSummarizeArticle).toHaveBeenCalledWith({
      title: "最新記事",
      content: "最新記事の本文です。",
      link: "https://example.com/article-2",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRepository.saveFeedHistory).toHaveBeenCalledWith({
      feedUrl: "https://example.com/feed",
      lastChecked: expect.any(String),
      articles: [
        {
          id: "article-1",
          title: "古い記事",
          link: "https://example.com/article-1",
          publishedDate: "2025-01-01T00:00:00Z",
        },
        {
          id: "article-2",
          title: "最新記事",
          link: "https://example.com/article-2",
          publishedDate: "2025-01-02T00:00:00Z",
        },
      ],
    });
  });

  it("複数の新着記事を個別にSlackに投稿する", async () => {
    // Given: 履歴に1つの記事が存在
    mockRepository.getFeedHistory.mockResolvedValue({
      feedUrl: "https://example.com/feed",
      lastChecked: "2025-01-01T00:00:00Z",
      articles: [
        {
          id: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          publishedDate: "2025-01-01T00:00:00Z",
        },
      ],
    });

    mockParserInstance.parseURL.mockResolvedValue({
      items: [
        {
          guid: "article-1",
          title: "既存記事",
          link: "https://example.com/article-1",
          content: "既存記事の本文",
          isoDate: "2025-01-01T00:00:00Z",
        },
        {
          guid: "article-2",
          title: "新着記事2",
          link: "https://example.com/article-2",
          content: "新着記事2の本文",
          isoDate: "2025-01-02T00:00:00Z",
        },
        {
          guid: "article-3",
          title: "新着記事3",
          link: "https://example.com/article-3",
          content: "新着記事3の本文",
          isoDate: "2025-01-03T00:00:00Z",
        },
      ],
    } as unknown as Parser.Output<Record<string, never>>);

    mockSummarizeArticle.mockResolvedValue("記事の要約です。");

    // When
    await runWorkflow(
      ["https://example.com/feed"],
      mockRepository,
      testWebhookUrl,
    );

    // Then: 2つの新着記事が個別に投稿される
    expect(mockSummarizeArticle).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("要約生成に失敗した場合はSlackにエラーを通知する", async () => {
    // Given
    mockRepository.getFeedHistory.mockResolvedValue(null);

    mockParserInstance.parseURL.mockResolvedValue({
      items: [
        {
          guid: "article-1",
          title: "記事",
          link: "https://example.com/article-1",
          content: "記事の本文",
          isoDate: "2025-01-01T00:00:00Z",
        },
      ],
    } as unknown as Parser.Output<Record<string, never>>);

    const testError = new Error("AI API Error");
    mockSummarizeArticle.mockRejectedValue(testError);

    // When
    await runWorkflow(
      ["https://example.com/feed"],
      mockRepository,
      testWebhookUrl,
    );

    // Then: エラーがSlackに投稿される
    expect(mockFetch).toHaveBeenCalledWith(
      testWebhookUrl,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("AI API Error"),
      }),
    );
  });

  it("Slack投稿に失敗してもエラーをスローしない", async () => {
    // Given
    mockRepository.getFeedHistory.mockResolvedValue(null);

    mockParserInstance.parseURL.mockResolvedValue({
      items: [
        {
          guid: "article-1",
          title: "記事",
          link: "https://example.com/article-1",
          content: "記事の本文",
          isoDate: "2025-01-01T00:00:00Z",
        },
      ],
    } as unknown as Parser.Output<Record<string, never>>);

    mockSummarizeArticle.mockResolvedValue("要約");
    mockFetch.mockRejectedValue(new Error("Network Error"));

    // When & Then: エラーがスローされない
    await expect(
      runWorkflow(
        ["https://example.com/feed"],
        mockRepository,
        testWebhookUrl,
      ),
    ).resolves.not.toThrow();
  });
});
