import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export interface ArticleToSummarize {
  title: string;
  content: string;
  link: string;
}

/**
 * 記事を要約する
 * @param article - 要約する記事
 * @returns 要約されたテキスト
 */
export async function summarizeArticle(
  article: ArticleToSummarize,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const prompt = `以下の記事を簡潔に要約してください。

タイトル: ${article.title}

本文:
${article.content || "（本文なし）"}

要約は200文字以内でお願いします。`;

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    prompt,
  });

  return text;
}
