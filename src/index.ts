import { runWorkflow } from "./application/web-summarize-service";
import { JsonArticleRepository } from "./infrastructure/json-article-repository";
import cron from "node-cron";
import "dotenv/config";

async function main() {
  const feedUrlsString = process.env.RSS_FEED_URLS;
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!feedUrlsString) {
    console.error("Error: RSS_FEED_URLS environment variable is not set");
    process.exit(1);
  }

  if (!slackWebhookUrl) {
    console.error("Error: SLACK_WEBHOOK_URL environment variable is not set");
    process.exit(1);
  }

  const feedUrls = feedUrlsString.split(",").map((url) => url.trim());

  const repository = new JsonArticleRepository("./data/article-history.json");

  console.log("Starting RSS monitoring AI agent...");
  console.log(`Monitoring ${feedUrls.length} RSS feed(s)`);

  await runWorkflow(feedUrls, repository, slackWebhookUrl);

  cron.schedule("0 */6 * * *", async () => {
    console.log("Running scheduled workflow...");
    await runWorkflow(feedUrls, repository, slackWebhookUrl);
  });

  console.log("Scheduled workflow every 6 hours (0 */6 * * *)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
