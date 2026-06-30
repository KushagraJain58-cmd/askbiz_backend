/**
 * Seed script: populates businessCategory in Configuration with the same
 * category names used in the interests seed.
 *
 * Usage (from askbiz_backend/):
 *   node scripts/seedBusinessCategories.js
 *
 * Idempotent: existing entries (matched by name, case-insensitive) are skipped.
 */

const mongoose = require("mongoose");
const { config } = require("../utils/config");
const Configuration = require("../src/models/configuration");

const businessCategories = [
  "Agriculture & Farming",
  "Food & Beverages",
  "Textiles & Apparel",
  "Information Technology",
  "E-Commerce & Retail",
  "Healthcare & Pharma",
  "Education & EdTech",
  "Real Estate & Construction",
  "Banking & Finance",
  "FinTech",
  "Manufacturing",
  "Automobiles",
  "Logistics & Supply Chain",
  "Travel & Tourism",
  "Beauty & Wellness",
  "Media & Entertainment",
  "Marketing & Advertising",
  "Energy & Power",
  "Handicrafts & Artisans",
  "Jewellery & Gems",
  "Consulting & Professional Services",
  "Telecommunications",
  "Hospitality",
  "Electronics & Electricals",
  "Furniture & Home Decor",
  "Printing & Packaging",
  "Sports & Fitness",
  "Petrochemicals & Plastics",
  "Mining & Minerals",
  "Aviation & Aerospace",
  "Pharmaceuticals & Biotech",
  "Environmental Services",
  "Security Services",
  "Aquaculture & Fisheries",
  "Chemicals & Dyes",
  "Stationery & Office Supplies",
  "NGO & Social Enterprise",
  "Gig & On-Demand Services",
  "Pet Care",
  "Dairy & Cattle",
  "Gems & Mineral Trading",
  "Apparel Export",
  "Photography & Videography",
  "Renewable & Green Tech",
  "Co-Working & Office Spaces",
];

async function seed() {
  await mongoose.connect(config.mongodburl, { serverSelectionTimeoutMS: 30000 });
  console.log("Connected to MongoDB");

  let configuration = await Configuration.findOne();
  if (!configuration) {
    configuration = new Configuration({ businessCategory: [] });
  }
  if (!Array.isArray(configuration.businessCategory)) {
    configuration.businessCategory = [];
  }

  let added = 0;

  for (const name of businessCategories) {
    const exists = configuration.businessCategory.some(
      (c) => (c.businessCategoryName || "").trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (!exists) {
      configuration.businessCategory.push({ businessCategoryName: name, status: "active" });
      added++;
    }
  }

  await configuration.save();

  console.log(`Business categories added: ${added}, skipped (already existed): ${businessCategories.length - added}`);
  console.log(`Total business categories: ${configuration.businessCategory.length}`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
