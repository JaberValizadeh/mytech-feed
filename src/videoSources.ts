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
  {
    id: "andrej-karpathy",
    name: "Andrej Karpathy",
    channelId: "UCPk8m_r6fkUSYmvgCBwq-sw",
    defaultCategory: "ai",
  },
  {
    id: "ml-street-talk",
    name: "Machine Learning Street Talk",
    channelId: "UCMLtBahI5DMrt0NPvDSoIRQ",
    defaultCategory: "ai",
  },
  {
    id: "robert-miles-ai",
    name: "Robert Miles AI Safety",
    channelId: "UCLB7AzTwc6VFZrBsO2ucBMg",
    defaultCategory: "ai",
  },
  {
    id: "matt-wolfe",
    name: "Matt Wolfe",
    channelId: "UChpleBmo18P08aKCIgti38g",
    defaultCategory: "ai",
  },
  {
    id: "wes-roth",
    name: "Wes Roth",
    channelId: "UCqcbQf6yw5KzRoDDcZ_wBSw",
    defaultCategory: "ai",
  },
  {
    id: "sentdex",
    name: "sentdex",
    channelId: "UCfzlCWGWYyIQ0aLC5w48gBQ",
    defaultCategory: "ai",
  },

  // ── Robotics (pure — real robots only) ────────────────────────────────────
  {
    id: "boston-dynamics",
    name: "Boston Dynamics",
    channelId: "UC7vVhkEfw4nOGp8TyDk7RcQ",
    defaultCategory: "robotics",
  },
  {
    id: "unitree-robotics",
    name: "Unitree Robotics",
    channelId: "UCsMbp4V8oxzHCMdOUP-3oWw",
    defaultCategory: "robotics",
  },
  {
    id: "agility-robotics",
    name: "Agility Robotics",
    channelId: "UCN-StetwWuVYf-MU2_NVj4A",
    defaultCategory: "robotics",
  },
  {
    id: "anybotics",
    name: "ANYbotics",
    channelId: "UC1B-ML60I2hKTvygvMjubnw",
    defaultCategory: "robotics",
  },
  {
    id: "skyentific",
    name: "Skyentific",
    channelId: "UCcgqJ1blFKqbC2bWGY4Opmg",
    defaultCategory: "robotics",
  },
  {
    id: "james-bruton",
    name: "James Bruton",
    channelId: "UCUbDcUPed50Y_7KmfCXKohA",
    defaultCategory: "robotics",
  },
  {
    id: "kscale-labs",
    name: "K-Scale Labs",
    channelId: "UCykPnpAHwDZgX-hHqw0lcgQ",
    defaultCategory: "robotics",
  },
  {
    id: "simone-giertz",
    name: "Simone Giertz",
    channelId: "UC3KEoMzNz8eYnwBC34RaKCQ",
    defaultCategory: "robotics",
  },

  // ── Engineering / Maker (attractive, but not pure robotics) ───────────────
  {
    id: "real-engineering",
    name: "Real Engineering",
    channelId: "UCR1IuLEqb6UEA_zQ81kwXfg",
    defaultCategory: "science",
  },
  {
    id: "mark-rober",
    name: "Mark Rober",
    channelId: "UCY1kMZp36IQSyNx_9h4mpCg",
    defaultCategory: "science",
  },
  {
    id: "hacksmith",
    name: "Hacksmith Industries",
    channelId: "UCjgpFI5dU-D1-kh9H1muoxQ",
    defaultCategory: "general",
  },
  {
    id: "tested",
    name: "Adam Savage’s Tested",
    channelId: "UCiDJtJKMICpb9B1qf7qjEOA",
    defaultCategory: "general",
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
