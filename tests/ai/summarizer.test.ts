import { summarizeArticle } from "../../src/ai/summarizer";
import { generateText } from "ai";

jest.mock("ai", () => ({
  generateText: jest.fn(),
}));

describe("summarizeArticle", () => {
  const mockGenerateText = generateText as jest.MockedFunction<
    typeof generateText
  >;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    mockGenerateText.mockReset();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("記事のタイトルとコンテンツを要約できる", async () => {
    // Given
    const article = {
      title: "テスト記事のタイトル",
      content:
        "これはテスト記事の本文です。この記事は非常に長い内容を含んでいますが、AIによって簡潔に要約されるべきです。",
      link: "https://example.com/article-1",
    };
    mockGenerateText.mockResolvedValue({
      text: "テスト記事の要約です。",
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    } as any);

    // When
    const summary = await summarizeArticle(article);

    // Then
    expect(summary).toBe("テスト記事の要約です。");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(article.title),
      }),
    );
  });

  it("空のコンテンツでもエラーを投げずに処理できる", async () => {
    // Given
    const article = {
      title: "タイトルのみの記事",
      content: "",
      link: "https://example.com/article-2",
    };
    mockGenerateText.mockResolvedValue({
      text: "タイトルのみの記事の要約です。",
      finishReason: "stop",
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    } as any);

    // When
    const summary = await summarizeArticle(article);

    // Then
    expect(summary).toBe("タイトルのみの記事の要約です。");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("ANTHROPIC_API_KEYが設定されていない場合、エラーを投げる", async () => {
    // Given
    delete process.env.ANTHROPIC_API_KEY;
    const article = {
      title: "テスト記事",
      content: "テスト本文",
      link: "https://example.com/article",
    };

    // When & Then
    await expect(summarizeArticle(article)).rejects.toThrow(
      "ANTHROPIC_API_KEY environment variable is not set",
    );
  });
});
