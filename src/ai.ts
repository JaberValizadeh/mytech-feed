import OpenAI from "openai";
import type { CategoryId, ProcessedArticle, RawArticle } from "./types.js";
import { CATEGORY_IDS } from "./types.js";
import { readingMinutes, truncate } from "./util.js";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// Constructed lazily: the OpenAI SDK throws if no key is set, and we only call
// it once the pipeline has confirmed OPENAI_API_KEY exists. This keeps the API
// server able to boot (and serve existing data) even with no key configured.
let _client: OpenAI | null = null;
function client(): OpenAI {
  // maxRetries: the SDK retries 429s with exponential backoff, honoring the
  // Retry-After header — this self-throttles us under the account's TPM limit.
  if (!_client) _client = new OpenAI({ maxRetries: 8 }); // reads OPENAI_API_KEY from env
  return _client;
}

/**
 * JSON schema the model must fill. Structured outputs guarantee valid, parseable
 * JSON matching this shape — no prompt-prefill or brittle parsing needed.
 * (Structured outputs don't support string length / array constraints, so the
 * limits below are expressed in the prompt instead.)
 */
const ENRICHMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    titleFa: { type: "string", description: "روان و خبری، ترجمه عنوان به فارسی" },
    summaryFa: { type: "string", description: "خلاصه دو تا سه جمله‌ای به فارسی" },
    insightsFa: {
      type: "array",
      items: { type: "string" },
      description: "سه تا پنج نکته کلیدی به فارسی",
    },
    whyItMattersFa: {
      type: "string",
      description: "چرا این خبر مهم است، یک تا دو جمله تحلیلی به فارسی",
    },
    category: { type: "string", enum: CATEGORY_IDS },
    tagsFa: {
      type: "array",
      items: { type: "string" },
      description: "سه تا شش برچسب کوتاه فارسی",
    },
  },
  required: [
    "titleFa",
    "summaryFa",
    "insightsFa",
    "whyItMattersFa",
    "category",
    "tagsFa",
  ],
} as const;

interface Enrichment {
  titleFa: string;
  summaryFa: string;
  insightsFa: string[];
  whyItMattersFa: string;
  category: CategoryId;
  tagsFa: string[];
}

const SYSTEM_PROMPT = `تو سردبیر هوش مصنوعی یک سرویس خبری فناوری به نام «تک‌نیوز فارسی» هستی. مخاطب تو توسعه‌دهندگان نرم‌افزار، پژوهشگران هوش مصنوعی، بنیان‌گذاران استارتاپ و علاقه‌مندان حرفه‌ای فناوری فارسی‌زبان هستند.

وظیفه تو فقط ترجمه نیست؛ باید خبر را بازآفرینی کنی:
- عنوان را روان و طبیعی به فارسی برگردان (نه ترجمه تحت‌اللفظی).
- خلاصه‌ای دقیق در دو تا سه جمله بنویس.
- سه تا پنج نکته کلیدی استخراج کن.
- در یک تا دو جمله توضیح بده «چرا این خبر مهم است».
- مناسب‌ترین دسته‌بندی را انتخاب کن.
- سه تا شش برچسب کوتاه فارسی برای کشف‌پذیری بساز.

قواعد:
- فارسی روان، حرفه‌ای و بدون غلط بنویس. از نیم‌فاصله درست استفاده کن.
- نام محصولات، شرکت‌ها و اصطلاحات فنی جاافتاده را به انگلیسی نگه دار (مثل OpenAI، GPT، API).
- چیزی از خودت اضافه نکن که در متن منبع نیست.`;

const CATEGORY_GUIDE = `راهنمای دسته‌ها: ai=هوش مصنوعی، startups=استارتاپ و سرمایه‌گذاری، hardware=سخت‌افزار و گجت، software=نرم‌افزار و توسعه، security=امنیت و حریم خصوصی، science=علم و پژوهش، business=کسب‌وکار فناوری، policy=سیاست‌گذاری و قانون، general=عمومی.`;

/** Run the AI enrichment for a single article. */
async function enrich(article: RawArticle): Promise<Enrichment> {
  const userContent = `${CATEGORY_GUIDE}

منبع: ${article.sourceName}
عنوان اصلی: ${article.title}

متن اصلی:
${truncate(article.content, 2000) || "(متن کامل در دسترس نیست؛ بر اساس عنوان کار کن.)"}`;

  const response = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "enrichment",
        strict: true,
        schema: ENRICHMENT_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  });

  const message = response.choices[0]?.message;
  if (message?.refusal) throw new Error(`Model refused: ${message.refusal}`);
  if (!message?.content) throw new Error("Empty model response");
  return JSON.parse(message.content) as Enrichment;
}

/**
 * Process unique articles into enriched, Persian articles. Runs with bounded
 * concurrency so we don't slam the API. Failed items are skipped (logged).
 */
export async function enrichAll(
  articles: RawArticle[],
  duplicateOf: Map<string, string>,
  concurrency = Number(process.env.AI_CONCURRENCY ?? 2),
): Promise<ProcessedArticle[]> {
  const out: ProcessedArticle[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < articles.length) {
      const article = articles[index++];
      const n = index;
      try {
        const e = await enrich(article);
        out.push({
          ...article,
          ...e,
          readingMinutes: readingMinutes(article.content || article.title),
          duplicateOf: duplicateOf.get(article.id),
          processedAt: new Date().toISOString(),
        });
        console.log(`  ✓ [${n}/${articles.length}] ${e.titleFa}`);
      } catch (err) {
        console.warn(
          `  ✗ [${n}/${articles.length}] ${article.title}: ${String(err).slice(0, 120)}`,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, articles.length) }, worker),
  );

  // Newest first.
  out.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return out;
}
