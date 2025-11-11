import type { ArticleRepository, Article } from "./article-repository";
import { summarizeArticle } from "../ai/summarizer";
import Parser from "rss-parser";

interface FeedItem {
  guid?: string;
  title?: string;
  link?: string;
  content?: string;
  isoDate?: string;
}

export async function runWorkflow(
  feedUrls: string[],
  repository: ArticleRepository,
  slackWebhookUrl: string,
): Promise<void> {
  for (const feedUrl of feedUrls) {
    try {
      const parser = new Parser();
      const feed = await parser.parseURL(feedUrl);
      const feedItems = feed.items;

      // 新着記事を取得
      const newArticles = await getNewArticles(feedUrl, feedItems, repository);

      // 各新着記事を要約してSlackに投稿
      for (const article of newArticles) {
        const summary = await summarizeArticle({
          title: article.title || "",
          content: article.content || "",
          link: article.link || "",
        });

        await postToSlack(slackWebhookUrl, {
          title: article.title || "",
          link: article.link || "",
          summary,
        });
      }

      // 履歴を保存
      const articles: Article[] = feedItems.map((item) => ({
        id: item.guid || "",
        title: item.title || "",
        link: item.link || "",
        publishedDate: item.isoDate || "",
      }));

      await repository.saveFeedHistory({
        feedUrl,
        lastChecked: new Date().toISOString(),
        articles,
      });
    } catch (error) {
      // ワークフロー全体のエラーを通知
      await postErrorToSlack(
        slackWebhookUrl,
        error as Error,
        `フィード: ${feedUrl}`,
      );
    }
  }
}

async function getNewArticles(
  feedUrl: string,
  feedItems: FeedItem[],
  repository: ArticleRepository,
): Promise<FeedItem[]> {
  const history = await repository.getFeedHistory(feedUrl);

  if (!history) {
    // 初回実行時は最新記事のみを対象
    const latestArticle = findLatestArticle(feedItems);
    return latestArticle ? [latestArticle] : [];
  }

  // 履歴と比較して新着記事のみ抽出
  const existingIds = new Set(history.articles.map((a) => a.id));
  return feedItems.filter((item) => !existingIds.has(item.guid || ""));
}

function findLatestArticle(feedItems: FeedItem[]): FeedItem | null {
  if (feedItems.length === 0) {
    return null;
  }

  return feedItems.reduce((latest, current) => {
    const latestDate = new Date(latest.isoDate || 0);
    const currentDate = new Date(current.isoDate || 0);
    return currentDate > latestDate ? current : latest;
  });
}

async function postToSlack(
  webhookUrl: string,
  article: { title: string; link: string; summary: string },
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `新着記事: ${article.title}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: article.title,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: article.summary,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `<${article.link}|記事を読む>`,
            },
          },
        ],
      }),
    });
  } catch (error) {
    // Slack投稿失敗はログに記録するが、エラーをスローしない
    console.error("Failed to post to Slack:", error);
  }
}

async function postErrorToSlack(
  webhookUrl: string,
  error: Error,
  context: string,
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `⚠️ エラーが発生しました`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "⚠️ エラーが発生しました",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*コンテキスト:*\n${context}`,
              },
              {
                type: "mrkdwn",
                text: `*エラー:*\n${error.message}`,
              },
            ],
          },
        ],
      }),
    });
  } catch (slackError) {
    // Slack投稿失敗はログに記録
    console.error("Failed to post error to Slack:", slackError);
  }
}
