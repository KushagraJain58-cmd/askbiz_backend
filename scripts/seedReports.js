/**
 * Seed script: populates report reasons in Configuration.reports.
 *
 * Usage (from askbiz_backend/):
 *   node scripts/seedReports.js
 *
 * Idempotent: existing entries (matched by reportName) are skipped.
 */

const mongoose = require("mongoose");
const { config } = require("../utils/config");
const Configuration = require("../src/models/configuration");

const reportReasons = [
  {
    reportName: "Spam",
    description: "This post is unsolicited, repetitive, or commercial in nature.",
  },
  {
    reportName: "Misinformation or Fake News",
    description: "This post contains false or misleading information.",
  },
  {
    reportName: "Hate Speech or Discrimination",
    description: "This post promotes hatred based on religion, caste, race, gender, or ethnicity.",
  },
  {
    reportName: "Harassment or Bullying",
    description: "This post is targeted at an individual to intimidate or cause distress.",
  },
  {
    reportName: "Nudity or Sexual Content",
    description: "This post contains explicit or sexually suggestive content.",
  },
  {
    reportName: "Violence or Graphic Content",
    description: "This post contains violent, disturbing, or graphic imagery.",
  },
  {
    reportName: "Scam or Fraud",
    description: "This post is attempting to deceive people for financial gain.",
  },
  {
    reportName: "Intellectual Property Violation",
    description: "This post uses copyrighted content without permission.",
  },
  {
    reportName: "Impersonation",
    description: "This post is pretending to be someone else or a known brand.",
  },
  {
    reportName: "Self-Harm or Suicide",
    description: "This post encourages or depicts self-harm or suicidal behaviour.",
  },
  {
    reportName: "Terrorism or Extremism",
    description: "This post promotes or glorifies terrorist activity or extremist ideology.",
  },
  {
    reportName: "Child Safety",
    description: "This post contains content that endangers or exploits minors.",
  },
  {
    reportName: "Privacy Violation",
    description: "This post shares someone's personal or private information without consent.",
  },
  {
    reportName: "Irrelevant or Off-Topic",
    description: "This post is not relevant to the community or discussion.",
  },
  {
    reportName: "Other",
    description: "Another reason not listed above.",
  },
];

async function seed() {
  await mongoose.connect(config.mongodburl, { serverSelectionTimeoutMS: 30000 });
  console.log("Connected to MongoDB");

  let configuration = await Configuration.findOne();
  if (!configuration) configuration = new Configuration({ reports: [] });
  if (!Array.isArray(configuration.reports)) configuration.reports = [];

  let added = 0;
  for (const entry of reportReasons) {
    const exists = configuration.reports.some(
      (r) => (r.reportName || "").trim().toLowerCase() === entry.reportName.trim().toLowerCase()
    );
    if (!exists) {
      configuration.reports.push({ ...entry, status: "active" });
      added++;
    }
  }

  await configuration.save();
  console.log(`Report reasons added: ${added}, total: ${configuration.reports.length}`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
