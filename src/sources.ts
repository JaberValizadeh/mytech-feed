import type { Source } from "./types.js";

/** The leading international tech sources we aggregate, with their public RSS feeds. */
export const SOURCES: Source[] = [
  {
    id: "techcrunch",
    name: "TechCrunch",
    homepage: "https://techcrunch.com",
    feedUrl: "https://techcrunch.com/feed/",
  },
  {
    id: "theverge",
    name: "The Verge",
    homepage: "https://www.theverge.com",
    feedUrl: "https://www.theverge.com/rss/index.xml",
  },
  {
    id: "wired",
    name: "Wired",
    homepage: "https://www.wired.com",
    feedUrl: "https://www.wired.com/feed/rss",
  },
  {
    id: "arstechnica",
    name: "Ars Technica",
    homepage: "https://arstechnica.com",
    feedUrl: "https://feeds.arstechnica.com/arstechnica/index",
  },
  {
    id: "mit-tech-review",
    name: "MIT Technology Review",
    homepage: "https://www.technologyreview.com",
    feedUrl: "https://www.technologyreview.com/feed/",
  },
  {
    id: "venturebeat",
    name: "VentureBeat",
    homepage: "https://venturebeat.com",
    feedUrl: "https://venturebeat.com/feed/",
  },
  {
    id: "hackernews",
    name: "Hacker News",
    homepage: "https://news.ycombinator.com",
    // Front-page stories with >100 points.
    feedUrl: "https://hnrss.org/frontpage?points=100",
  },
  {
    id: "openai",
    name: "OpenAI Blog",
    homepage: "https://openai.com/blog",
    feedUrl: "https://openai.com/news/rss.xml",
  },
  {
    id: "google-ai",
    name: "Google AI Blog",
    homepage: "https://blog.google/technology/ai/",
    feedUrl: "https://blog.google/technology/ai/rss/",
  },
  {
    id: "microsoft-ai",
    name: "Microsoft AI Blog",
    homepage: "https://news.microsoft.com/source/topics/ai/",
    feedUrl: "https://news.microsoft.com/source/topics/ai/feed/",
  },
  {
    id: "geekwire",
    name: "GeekWire",
    homepage: "https://www.geekwire.com",
    feedUrl: "https://www.geekwire.com/feed/",
  },
  {
    id: "engadget",
    name: "Engadget",
    homepage: "https://www.engadget.com",
    feedUrl: "https://www.engadget.com/rss.xml",
  },
  {
    id: "gizmodo",
    name: "Gizmodo",
    homepage: "https://gizmodo.com",
    feedUrl: "https://gizmodo.com/feed",
  },
  {
    id: "cnet",
    name: "CNET",
    homepage: "https://www.cnet.com",
    feedUrl: "https://www.cnet.com/rss/news/",
  },
  {
    id: "zdnet",
    name: "ZDNet",
    homepage: "https://www.zdnet.com",
    feedUrl: "https://www.zdnet.com/news/rss.xml",
  },
  {
    id: "techradar",
    name: "TechRadar",
    homepage: "https://www.techradar.com",
    feedUrl: "https://www.techradar.com/rss",
  },
  {
    id: "digital-trends",
    name: "Digital Trends",
    homepage: "https://www.digitaltrends.com",
    feedUrl: "https://www.digitaltrends.com/feed/",
  },
  {
    id: "9to5mac",
    name: "9to5Mac",
    homepage: "https://9to5mac.com",
    feedUrl: "https://9to5mac.com/feed/",
  },
  {
    id: "thenextweb",
    name: "The Next Web",
    homepage: "https://thenextweb.com",
    feedUrl: "https://thenextweb.com/feed",
  },
  {
    id: "deepmind",
    name: "Google DeepMind",
    homepage: "https://deepmind.google",
    feedUrl: "https://deepmind.google/blog/rss.xml",
  },

  // ── General Tech ──────────────────────────────────────────────────────────
  {
    id: "the-register",
    name: "The Register",
    homepage: "https://www.theregister.com",
    feedUrl: "https://www.theregister.com/headlines.atom",
  },
  {
    id: "computerworld",
    name: "Computerworld",
    homepage: "https://www.computerworld.com",
    feedUrl: "https://www.computerworld.com/index.rss",
  },
  {
    id: "pcmag",
    name: "PCMag",
    homepage: "https://www.pcmag.com",
    feedUrl: "https://www.pcmag.com/rss",
  },
  {
    id: "toms-hardware",
    name: "Tom's Hardware",
    homepage: "https://www.tomshardware.com",
    feedUrl: "https://www.tomshardware.com/feeds/all",
  },
  {
    id: "toms-guide",
    name: "Tom's Guide",
    homepage: "https://www.tomsguide.com",
    feedUrl: "https://www.tomsguide.com/feeds/all",
  },
  {
    id: "android-authority",
    name: "Android Authority",
    homepage: "https://www.androidauthority.com",
    feedUrl: "https://www.androidauthority.com/feed/",
  },
  {
    id: "9to5google",
    name: "9to5Google",
    homepage: "https://9to5google.com",
    feedUrl: "https://9to5google.com/feed/",
  },
  {
    id: "macrumors",
    name: "MacRumors",
    homepage: "https://www.macrumors.com",
    feedUrl: "https://feeds.macrumors.com/MacRumors-All",
  },
  {
    id: "appleinsider",
    name: "AppleInsider",
    homepage: "https://appleinsider.com",
    feedUrl: "https://appleinsider.com/rss/news/",
  },
  {
    id: "siliconangle",
    name: "SiliconANGLE",
    homepage: "https://siliconangle.com",
    feedUrl: "https://siliconangle.com/feed/",
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    id: "dark-reading",
    name: "Dark Reading",
    homepage: "https://www.darkreading.com",
    feedUrl: "https://www.darkreading.com/rss.xml",
  },
  {
    id: "securityweek",
    name: "SecurityWeek",
    homepage: "https://www.securityweek.com",
    feedUrl: "https://www.securityweek.com/feed/",
  },
  {
    id: "the-hacker-news",
    name: "The Hacker News",
    homepage: "https://thehackernews.com",
    feedUrl: "https://feeds.feedburner.com/TheHackersNews",
  },
  {
    id: "krebs-security",
    name: "Krebs on Security",
    homepage: "https://krebsonsecurity.com",
    feedUrl: "https://krebsonsecurity.com/feed/",
  },
  {
    id: "bleeping-computer",
    name: "Bleeping Computer",
    homepage: "https://www.bleepingcomputer.com",
    feedUrl: "https://www.bleepingcomputer.com/feed/",
  },

  // ── AI & Research ─────────────────────────────────────────────────────────
  {
    id: "anthropic",
    name: "Anthropic Blog",
    homepage: "https://www.anthropic.com/news",
    feedUrl: "https://www.anthropic.com/news/rss.xml",
  },
  {
    id: "huggingface",
    name: "Hugging Face Blog",
    homepage: "https://huggingface.co/blog",
    feedUrl: "https://huggingface.co/blog/feed.xml",
  },
  {
    id: "ieee-spectrum",
    name: "IEEE Spectrum",
    homepage: "https://spectrum.ieee.org",
    feedUrl: "https://spectrum.ieee.org/feeds/feed.rss",
  },
  {
    id: "nvidia-blog",
    name: "NVIDIA Blog",
    homepage: "https://blogs.nvidia.com",
    feedUrl: "https://blogs.nvidia.com/feed/",
  },
  {
    id: "sciencedaily-ai",
    name: "ScienceDaily AI",
    homepage: "https://www.sciencedaily.com/news/computers_math/artificial_intelligence/",
    feedUrl: "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml",
  },
  {
    id: "meta-ai",
    name: "Meta AI Blog",
    homepage: "https://ai.meta.com/blog/",
    feedUrl: "https://ai.meta.com/blog/feed/",
  },

  // ── Developer / Open Source ───────────────────────────────────────────────
  {
    id: "dev-to",
    name: "DEV Community",
    homepage: "https://dev.to",
    feedUrl: "https://dev.to/feed",
  },
  {
    id: "github-blog",
    name: "GitHub Blog",
    homepage: "https://github.blog",
    feedUrl: "https://github.blog/feed/",
  },
  {
    id: "the-new-stack",
    name: "The New Stack",
    homepage: "https://thenewstack.io",
    feedUrl: "https://thenewstack.io/feed/",
  },
  {
    id: "hackernoon",
    name: "HackerNoon",
    homepage: "https://hackernoon.com",
    feedUrl: "https://hackernoon.com/feed",
  },
  {
    id: "slashdot",
    name: "Slashdot",
    homepage: "https://slashdot.org",
    feedUrl: "http://rss.slashdot.org/Slashdot/slashdotMain",
  },
  {
    id: "infoq",
    name: "InfoQ",
    homepage: "https://www.infoq.com",
    feedUrl: "https://www.infoq.com/feed/",
  },
  {
    id: "smashing-magazine",
    name: "Smashing Magazine",
    homepage: "https://www.smashingmagazine.com",
    feedUrl: "https://www.smashingmagazine.com/feed/",
  },
  {
    id: "logrocket",
    name: "LogRocket Blog",
    homepage: "https://blog.logrocket.com",
    feedUrl: "https://blog.logrocket.com/feed/",
  },

  // ── Major News / Business ─────────────────────────────────────────────────
  {
    id: "bbc-tech",
    name: "BBC Technology",
    homepage: "https://www.bbc.co.uk/news/technology",
    feedUrl: "http://feeds.bbci.co.uk/news/technology/rss.xml",
  },
  {
    id: "fast-company-tech",
    name: "Fast Company Tech",
    homepage: "https://www.fastcompany.com/technology",
    feedUrl: "https://www.fastcompany.com/technology/rss",
  },
  {
    id: "techrepublic",
    name: "TechRepublic",
    homepage: "https://www.techrepublic.com",
    feedUrl: "https://www.techrepublic.com/rssfeeds/articles/",
  },
  {
    id: "crunchbase-news",
    name: "Crunchbase News",
    homepage: "https://news.crunchbase.com",
    feedUrl: "https://news.crunchbase.com/feed/",
  },
  {
    id: "forbes-tech",
    name: "Forbes Technology",
    homepage: "https://www.forbes.com/technology/",
    feedUrl: "https://www.forbes.com/technology/feed/",
  },
  {
    id: "css-tricks",
    name: "CSS-Tricks",
    homepage: "https://css-tricks.com",
    feedUrl: "https://css-tricks.com/feed/",
  },
  {
    id: "mit-ai-news",
    name: "MIT News – AI",
    homepage: "https://news.mit.edu/topic/artificial-intelligence2",
    feedUrl: "https://news.mit.edu/rss/topic/artificial-intelligence2",
  },
];
