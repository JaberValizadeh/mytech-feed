import type { VideoSource } from "./types.js";

/**
 * YouTube channels we pull video content from.
 * Feed URL format: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 */
export const VIDEO_SOURCES: VideoSource[] = [
  // ── AI / Machine Learning ─────────────────────────────────────────────────
  {
    id: "two-minute-papers",
    name: "Two Minute Papers",
    channelId: "UCbfYPyITQ-7l4upoX8nvctg",
    defaultCategory: "ai",
  },
  {
    id: "lex-fridman",
    name: "Lex Fridman",
    channelId: "UCSHZKyawb77ixDdsGog4iWA",
    defaultCategory: "ai",
  },
  {
    id: "yannic-kilcher",
    name: "Yannic Kilcher",
    channelId: "UCZHmQk67mSJgfCCTn7xBfew",
    defaultCategory: "ai",
  },
  {
    id: "ai-explained",
    name: "AI Explained",
    channelId: "UCNJ1Ymd5yFuUPtn21xtRbbw",
    defaultCategory: "ai",
  },
  {
    id: "ibm-technology",
    name: "IBM Technology",
    channelId: "UCKWaEZ-_VweaEx1j62do_vQ",
    defaultCategory: "ai",
  },

  // ── Hardware / Gadgets ────────────────────────────────────────────────────
  {
    id: "mkbhd",
    name: "MKBHD",
    channelId: "UCBJycsmduvYEL83R_U4JriQ",
    defaultCategory: "hardware",
  },
  {
    id: "linus-tech-tips",
    name: "Linus Tech Tips",
    channelId: "UCXuqSBlHAE6Xw-yeJA0Tunw",
    defaultCategory: "hardware",
  },

  // ── Software / Development ────────────────────────────────────────────────
  {
    id: "fireship",
    name: "Fireship",
    channelId: "UCsBjURrPoezykLs9EqgamOA",
    defaultCategory: "software",
  },
  {
    id: "computerphile",
    name: "Computerphile",
    channelId: "UC9-y-6csu5WGm29I7JiwpnA",
    defaultCategory: "software",
  },
  {
    id: "sebastian-lague",
    name: "Sebastian Lague",
    channelId: "UCmtyQOKKmrMVaKuRXz02jbQ",
    defaultCategory: "software",
  },
  {
    id: "techworld-nana",
    name: "TechWorld with Nana",
    channelId: "UCdngmbVKX1Tgre699-XLlUA",
    defaultCategory: "software",
  },

  // ── Science / Education ───────────────────────────────────────────────────
  {
    id: "3blue1brown",
    name: "3Blue1Brown",
    channelId: "UCYO_jab_esuFRV4b17AJtAg",
    defaultCategory: "science",
  },
  {
    id: "veritasium",
    name: "Veritasium",
    channelId: "UCHnyfMqiRRG1u-2MsSQLbXA",
    defaultCategory: "science",
  },

  // ── General Tech ──────────────────────────────────────────────────────────
  {
    id: "coldfusion",
    name: "ColdFusion",
    channelId: "UC4QZ_LsYcvcq7qOsOhpAX4A",
    defaultCategory: "general",
  },
  {
    id: "techlinked",
    name: "TechLinked",
    channelId: "UCeeFfhMcJa1kjtfZAGskOCA",
    defaultCategory: "general",
  },
];
