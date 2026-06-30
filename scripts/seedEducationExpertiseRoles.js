/**
 * Seed script: populates Education, Area of Expertise (in Configuration)
 * and Admin / Sub Admin roles (in Role collection).
 *
 * Usage (from askbiz_backend/):
 *   node scripts/seedEducationExpertiseRoles.js
 *
 * Idempotent: existing entries are skipped, not duplicated.
 */

const mongoose = require("mongoose");
const { config } = require("../utils/config");
const Configuration = require("../src/models/configuration");
const Role = require("../src/models/roles");

// ── Education ─────────────────────────────────────────────────────────────────
const educationData = [
  { educationName: "High School (10th)", universityName: "" },
  { educationName: "Higher Secondary (12th)", universityName: "" },
  { educationName: "Diploma", universityName: "" },
  { educationName: "Bachelor of Arts (BA)", universityName: "" },
  { educationName: "Bachelor of Science (BSc)", universityName: "" },
  { educationName: "Bachelor of Commerce (BCom)", universityName: "" },
  { educationName: "Bachelor of Business Administration (BBA)", universityName: "" },
  { educationName: "Bachelor of Technology (BTech)", universityName: "" },
  { educationName: "Bachelor of Engineering (BE)", universityName: "" },
  { educationName: "Bachelor of Computer Applications (BCA)", universityName: "" },
  { educationName: "Bachelor of Pharmacy (BPharm)", universityName: "" },
  { educationName: "Bachelor of Medicine and Surgery (MBBS)", universityName: "" },
  { educationName: "Bachelor of Laws (LLB)", universityName: "" },
  { educationName: "Bachelor of Architecture (BArch)", universityName: "" },
  { educationName: "Bachelor of Design (BDes)", universityName: "" },
  { educationName: "Master of Arts (MA)", universityName: "" },
  { educationName: "Master of Science (MSc)", universityName: "" },
  { educationName: "Master of Commerce (MCom)", universityName: "" },
  { educationName: "Master of Business Administration (MBA)", universityName: "" },
  { educationName: "Master of Technology (MTech)", universityName: "" },
  { educationName: "Master of Computer Applications (MCA)", universityName: "" },
  { educationName: "Master of Laws (LLM)", universityName: "" },
  { educationName: "Master of Surgery (MS)", universityName: "" },
  { educationName: "Doctor of Medicine (MD)", universityName: "" },
  { educationName: "Doctor of Philosophy (PhD)", universityName: "" },
  { educationName: "Chartered Accountancy (CA)", universityName: "ICAI" },
  { educationName: "Company Secretary (CS)", universityName: "ICSI" },
  { educationName: "Cost Accountant (CMA)", universityName: "ICMAI" },
  { educationName: "Post Graduate Diploma in Management (PGDM)", universityName: "" },
  { educationName: "Certificate Course / Short-term Training", universityName: "" },
  { educationName: "ITI (Industrial Training Institute)", universityName: "" },
  { educationName: "Vocational Training", universityName: "" },
  { educationName: "Self-Taught / No Formal Degree", universityName: "" },
];

// ── Area of Expertise ─────────────────────────────────────────────────────────
const areaOfExpertiseData = [
  "Business Strategy & Planning",
  "Marketing & Brand Building",
  "Sales & Business Development",
  "Digital Marketing & SEO",
  "Social Media Management",
  "Finance & Accounting",
  "Fundraising & Investor Relations",
  "Operations & Supply Chain",
  "Product Management",
  "Software Development & Engineering",
  "Data Science & Analytics",
  "Artificial Intelligence & Machine Learning",
  "Cybersecurity",
  "Cloud & DevOps",
  "UI/UX Design",
  "Graphic Design & Branding",
  "Content Creation & Copywriting",
  "Legal & Compliance",
  "Taxation & GST",
  "Human Resources & Talent Acquisition",
  "Leadership & Team Management",
  "Entrepreneurship & Startups",
  "E-Commerce & Retail Management",
  "Export & Import (EXIM)",
  "Manufacturing & Production",
  "Real Estate & Property",
  "Healthcare & Medical Services",
  "Edtech & Training",
  "Agriculture & Agri-Tech",
  "Logistics & Distribution",
  "Customer Success & Support",
  "Public Relations & Communications",
  "Research & Development",
  "Sustainability & ESG",
  "Mergers & Acquisitions",
  "Franchise & Licensing",
  "Event Management",
  "Photography & Videography",
  "Interior Design & Architecture",
  "Food & Beverage Management",
];

// ── Roles ─────────────────────────────────────────────────────────────────────
const rolesData = [
  {
    roleName: "Admin",
    status: "active",
    permissions: [
      { module: "Dashboard", readAccess: true, fullAccess: true },
      { module: "Users", readAccess: true, fullAccess: true },
      { module: "Communities", readAccess: true, fullAccess: true },
      { module: "Posts", readAccess: true, fullAccess: true },
      { module: "Reports", readAccess: true, fullAccess: true },
      { module: "Configuration", readAccess: true, fullAccess: true },
      { module: "Roles", readAccess: true, fullAccess: true },
      { module: "Notifications", readAccess: true, fullAccess: true },
      { module: "Analytics", readAccess: true, fullAccess: true },
    ],
  },
  {
    roleName: "Sub Admin",
    status: "active",
    permissions: [
      { module: "Dashboard", readAccess: true, fullAccess: false },
      { module: "Users", readAccess: true, fullAccess: false },
      { module: "Communities", readAccess: true, fullAccess: false },
      { module: "Posts", readAccess: true, fullAccess: true },
      { module: "Reports", readAccess: true, fullAccess: true },
      { module: "Configuration", readAccess: true, fullAccess: false },
      { module: "Roles", readAccess: false, fullAccess: false },
      { module: "Notifications", readAccess: true, fullAccess: false },
      { module: "Analytics", readAccess: true, fullAccess: false },
    ],
  },
];

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(config.mongodburl, { serverSelectionTimeoutMS: 30000 });
  console.log("Connected to MongoDB\n");

  let configuration = await Configuration.findOne();
  if (!configuration) configuration = new Configuration({});

  // Education
  if (!Array.isArray(configuration.education)) configuration.education = [];
  let eduAdded = 0;
  for (const entry of educationData) {
    const exists = configuration.education.some(
      (e) => (e.educationName || "").trim().toLowerCase() === entry.educationName.trim().toLowerCase()
    );
    if (!exists) {
      configuration.education.push({ ...entry, status: "active" });
      eduAdded++;
    }
  }

  // Area of Expertise
  if (!Array.isArray(configuration.areaOfExpertise)) configuration.areaOfExpertise = [];
  let expertiseAdded = 0;
  for (const name of areaOfExpertiseData) {
    const exists = configuration.areaOfExpertise.some(
      (e) => (e.areaOfExpertiseName || "").trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (!exists) {
      configuration.areaOfExpertise.push({ areaOfExpertiseName: name, status: "active" });
      expertiseAdded++;
    }
  }

  await configuration.save();
  console.log(`Education     → added: ${eduAdded}, total: ${configuration.education.length}`);
  console.log(`Area of Expertise → added: ${expertiseAdded}, total: ${configuration.areaOfExpertise.length}`);

  // Roles
  let rolesAdded = 0;
  let rolesSkipped = 0;
  for (const roleData of rolesData) {
    const exists = await Role.findOne({
      roleName: { $regex: new RegExp(`^${roleData.roleName}$`, "i") },
    });
    if (!exists) {
      await Role.create(roleData);
      rolesAdded++;
    } else {
      rolesSkipped++;
    }
  }
  console.log(`Roles         → added: ${rolesAdded}, skipped: ${rolesSkipped}`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
