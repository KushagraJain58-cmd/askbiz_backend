/**
 * Seed script: populates Interests & Categories for real-world businesses in India.
 *
 * Usage (from askbiz_backend/):
 *   node scripts/seedInterests.js
 *
 * Each entry maps to one item in Configuration.interests:
 *   { categoryName, interestsName: [String], status }
 *
 * Re-running is safe: existing categories (matched by categoryName, case-insensitive)
 * are skipped, and only new interest names are merged into them.
 */

const mongoose = require("mongoose");
const { config } = require("../utils/config");
const Configuration = require("../src/models/configuration");

// ~45 categories covering real-world Indian business sectors.
const businessInterests = [
  {
    categoryName: "Agriculture & Farming",
    interestsName: ["Organic Farming", "Dairy Farming", "Poultry", "Horticulture", "Agri-Tech", "Fertilizers & Seeds", "Cold Storage"],
  },
  {
    categoryName: "Food & Beverages",
    interestsName: ["Restaurants", "Cloud Kitchens", "Street Food", "Packaged Foods", "Beverages", "Catering", "Bakery & Confectionery", "Spices & Masala"],
  },
  {
    categoryName: "Textiles & Apparel",
    interestsName: ["Handloom", "Garment Manufacturing", "Ethnic Wear", "Fabric Trading", "Fashion Design", "Embroidery & Zari", "Footwear"],
  },
  {
    categoryName: "Information Technology",
    interestsName: ["Software Development", "IT Services", "SaaS", "Cloud Computing", "Cybersecurity", "Data Analytics", "Artificial Intelligence"],
  },
  {
    categoryName: "E-Commerce & Retail",
    interestsName: ["Online Marketplace", "D2C Brands", "Kirana Stores", "Supermarkets", "Wholesale Trading", "Dropshipping"],
  },
  {
    categoryName: "Healthcare & Pharma",
    interestsName: ["Hospitals", "Clinics", "Diagnostics & Labs", "Pharmaceuticals", "Ayurveda", "Medical Devices", "Telemedicine"],
  },
  {
    categoryName: "Education & EdTech",
    interestsName: ["Schools", "Coaching Centers", "Online Courses", "Skill Training", "Test Preparation", "EdTech Platforms"],
  },
  {
    categoryName: "Real Estate & Construction",
    interestsName: ["Residential Projects", "Commercial Property", "Construction Materials", "Interior Design", "Property Brokerage", "Civil Engineering"],
  },
  {
    categoryName: "Banking & Finance",
    interestsName: ["Banking", "NBFC", "Microfinance", "Insurance", "Wealth Management", "Chartered Accountancy", "Loans & Mortgages"],
  },
  {
    categoryName: "FinTech",
    interestsName: ["Digital Payments", "UPI Solutions", "Lending Platforms", "InsurTech", "WealthTech", "Cryptocurrency"],
  },
  {
    categoryName: "Manufacturing",
    interestsName: ["Auto Components", "Machinery", "Electronics", "Plastics", "Steel & Metals", "Chemicals", "Industrial Equipment"],
  },
  {
    categoryName: "Automobiles",
    interestsName: ["Car Dealership", "Two Wheelers", "Electric Vehicles", "Auto Repair", "Spare Parts", "Commercial Vehicles"],
  },
  {
    categoryName: "Logistics & Supply Chain",
    interestsName: ["Transportation", "Warehousing", "Courier & Delivery", "Freight Forwarding", "Last-Mile Delivery", "Packers & Movers"],
  },
  {
    categoryName: "Travel & Tourism",
    interestsName: ["Travel Agency", "Hotels & Resorts", "Tour Operators", "Homestays", "Adventure Tourism", "Religious Tourism", "Ticketing"],
  },
  {
    categoryName: "Beauty & Wellness",
    interestsName: ["Salon & Spa", "Cosmetics", "Fitness & Gym", "Yoga & Meditation", "Skincare", "Personal Care Products"],
  },
  {
    categoryName: "Media & Entertainment",
    interestsName: ["Film Production", "Music", "OTT Platforms", "Gaming", "Event Management", "Photography", "Advertising"],
  },
  {
    categoryName: "Marketing & Advertising",
    interestsName: ["Digital Marketing", "SEO & SEM", "Social Media Marketing", "Branding", "PR & Communications", "Influencer Marketing"],
  },
  {
    categoryName: "Energy & Power",
    interestsName: ["Solar Energy", "Wind Energy", "Power Distribution", "Oil & Gas", "Renewable Energy", "EV Charging"],
  },
  {
    categoryName: "Handicrafts & Artisans",
    interestsName: ["Pottery", "Handmade Jewelry", "Wood Craft", "Khadi Products", "Home Decor", "Traditional Art"],
  },
  {
    categoryName: "Jewellery & Gems",
    interestsName: ["Gold Jewellery", "Diamond Trading", "Imitation Jewellery", "Gemstones", "Silver Articles"],
  },
  {
    categoryName: "Consulting & Professional Services",
    interestsName: ["Management Consulting", "Legal Services", "HR & Recruitment", "Tax Consulting", "Business Advisory", "Architecture"],
  },
  {
    categoryName: "Telecommunications",
    interestsName: ["Mobile Services", "Broadband", "Network Infrastructure", "VoIP", "Mobile Recharge & Retail"],
  },
  {
    categoryName: "Hospitality",
    interestsName: ["Banquet Halls", "Guest Houses", "Cafes & Lounges", "Cloud Hospitality", "Facility Management"],
  },
  {
    categoryName: "Electronics & Electricals",
    interestsName: ["Consumer Electronics", "Mobile Retail", "Home Appliances", "Electrical Goods", "Repair Services"],
  },
  {
    categoryName: "Furniture & Home Decor",
    interestsName: ["Modular Furniture", "Carpentry", "Home Furnishings", "Lighting", "Kitchen Fittings"],
  },
  {
    categoryName: "Printing & Packaging",
    interestsName: ["Offset Printing", "Digital Printing", "Corrugated Boxes", "Flexible Packaging", "Label Printing"],
  },
  {
    categoryName: "Sports & Fitness",
    interestsName: ["Sports Equipment", "Sports Academy", "Fitness Centers", "Sportswear", "Cricket Coaching"],
  },
  {
    categoryName: "Petrochemicals & Plastics",
    interestsName: ["Polymers", "Plastic Products", "Rubber", "Packaging Materials"],
  },
  {
    categoryName: "Mining & Minerals",
    interestsName: ["Coal", "Iron Ore", "Stone & Granite", "Sand & Gravel", "Mineral Processing"],
  },
  {
    categoryName: "Aviation & Aerospace",
    interestsName: ["Airlines", "Charter Services", "Ground Handling", "Drone Services", "Aircraft Maintenance"],
  },
  {
    categoryName: "Pharmaceuticals & Biotech",
    interestsName: ["Drug Manufacturing", "Biotechnology", "Clinical Research", "Nutraceuticals", "Veterinary Medicine"],
  },
  {
    categoryName: "Environmental Services",
    interestsName: ["Waste Management", "Recycling", "Water Treatment", "Pollution Control", "Sustainability Consulting"],
  },
  {
    categoryName: "Security Services",
    interestsName: ["Manned Guarding", "CCTV & Surveillance", "Cyber Security", "Fire Safety", "Access Control"],
  },
  {
    categoryName: "Aquaculture & Fisheries",
    interestsName: ["Fish Farming", "Shrimp Export", "Seafood Processing", "Marine Products"],
  },
  {
    categoryName: "Chemicals & Dyes",
    interestsName: ["Industrial Chemicals", "Specialty Chemicals", "Dyes & Pigments", "Paints & Coatings", "Agrochemicals"],
  },
  {
    categoryName: "Stationery & Office Supplies",
    interestsName: ["Paper Products", "Writing Instruments", "Office Furniture", "Corporate Gifting"],
  },
  {
    categoryName: "NGO & Social Enterprise",
    interestsName: ["Education NGO", "Healthcare NGO", "Rural Development", "Women Empowerment", "Microfinance NGO"],
  },
  {
    categoryName: "Gig & On-Demand Services",
    interestsName: ["Home Services", "Cleaning Services", "Plumbing & Electrician", "Pest Control", "Appliance Repair"],
  },
  {
    categoryName: "Pet Care",
    interestsName: ["Pet Food", "Veterinary Clinics", "Pet Grooming", "Pet Accessories"],
  },
  {
    categoryName: "Dairy & Cattle",
    interestsName: ["Milk Production", "Cheese & Paneer", "Cattle Feed", "Dairy Processing"],
  },
  {
    categoryName: "Gems & Mineral Trading",
    interestsName: ["Marble & Granite", "Cement", "Building Materials", "Hardware Trading"],
  },
  {
    categoryName: "Apparel Export",
    interestsName: ["Readymade Garments", "Leather Goods", "Home Textiles", "Carpets & Rugs"],
  },
  {
    categoryName: "Photography & Videography",
    interestsName: ["Wedding Photography", "Product Photography", "Drone Cinematography", "Studios"],
  },
  {
    categoryName: "Renewable & Green Tech",
    interestsName: ["Solar Panel Installation", "Biogas", "Energy Storage", "Green Building"],
  },
  {
    categoryName: "Co-Working & Office Spaces",
    interestsName: ["Co-Working Spaces", "Serviced Offices", "Business Centers", "Virtual Offices"],
  },
];

async function seed() {
  await mongoose.connect(config.mongodburl, { serverSelectionTimeoutMS: 30000 });
  console.log("Connected to MongoDB");

  let configuration = await Configuration.findOne();
  if (!configuration) {
    configuration = new Configuration({ interests: [] });
  }
  if (!Array.isArray(configuration.interests)) {
    configuration.interests = [];
  }

  let added = 0;
  let merged = 0;

  for (const entry of businessInterests) {
    const existing = configuration.interests.find(
      (c) => (c.categoryName || "").trim().toLowerCase() === entry.categoryName.trim().toLowerCase()
    );

    if (!existing) {
      configuration.interests.push({
        categoryName: entry.categoryName,
        interestsName: entry.interestsName,
        status: "active",
      });
      added++;
    } else {
      const before = existing.interestsName.length;
      const set = new Set(existing.interestsName.map((i) => i.toLowerCase()));
      for (const name of entry.interestsName) {
        if (!set.has(name.toLowerCase())) {
          existing.interestsName.push(name);
        }
      }
      if (existing.interestsName.length > before) merged++;
    }
  }

  await configuration.save();

  const totalInterests = configuration.interests.reduce(
    (sum, c) => sum + (c.interestsName ? c.interestsName.length : 0),
    0
  );

  console.log(`Categories added: ${added}, categories updated: ${merged}`);
  console.log(`Total categories: ${configuration.interests.length}, total interests: ${totalInterests}`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
