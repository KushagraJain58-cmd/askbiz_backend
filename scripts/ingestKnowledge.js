require('dotenv').config();
const mongoose = require('mongoose');
const { config } = require('../utils/config');
const { ingestChunk } = require('../src/services/ai/ragService');
const KnowledgeChunk = require('../src/models/knowledgeChunk');

const KNOWLEDGE_BASE = [
  {
    title: 'Udyam MSME Registration',
    category: 'registration',
    tags: ['msme', 'udyam', 'registration', 'small business'],
    content: `Udyam Registration is the official MSME registration for businesses in India, replacing the older Udyog Aadhaar. It is free and available at udyamregistration.gov.in. Any business with investment in plant and machinery under ₹50 crore (for manufacturing) or ₹10 crore (for services) and turnover under ₹250 crore qualifies as an MSME. Udyam registration gives access to priority sector lending, government scheme benefits, delayed payment protection, and easier bank loan processing. The process requires an Aadhaar number and PAN card. No documents need to be uploaded — the portal auto-verifies via government databases.`,
  },
  {
    title: 'GST Registration for Small Businesses',
    category: 'gst',
    tags: ['gst', 'tax', 'registration', 'small business'],
    content: `GST registration is mandatory if a business's annual turnover exceeds ₹40 lakh for goods or ₹20 lakh for services (₹10 lakh for special category states). Voluntary registration is allowed below these thresholds. GST registration is done at gst.gov.in and is free. Required documents include PAN, Aadhaar, bank account details, proof of business address, and photographs. Once registered, businesses must file monthly or quarterly GSTR-1 (outward supplies) and GSTR-3B (summary return). Composition scheme is available for businesses with turnover under ₹1.5 crore — they pay a flat GST rate and file quarterly returns.`,
  },
  {
    title: 'Startup India Recognition and Benefits',
    category: 'registration',
    tags: ['startup', 'startup india', 'dpiit', 'tax exemption'],
    content: `Startup India recognition is granted by DPIIT (Department for Promotion of Industry and Internal Trade) to eligible startups. A startup must be less than 10 years old, have annual turnover not exceeding ₹100 crore, and be working toward innovation, development, or improvement of products or services. Key benefits include: 3-year income tax exemption (Section 80-IAC), exemption from capital gains tax on investments (Section 56), fast-track patent applications at 80% fee concession, self-certification under labour and environmental laws, and easier public procurement norms. Apply at startupindia.gov.in using PAN and business documents.`,
  },
  {
    title: 'PMEGP — Prime Minister Employment Generation Programme',
    category: 'funding',
    tags: ['funding', 'subsidy', 'loan', 'pmegp', 'government scheme'],
    content: `PMEGP is a central government scheme for starting or expanding a business using a bank loan with a government subsidy. Maximum project cost: ₹50 lakh for manufacturing, ₹20 lakh for service sector. Government subsidy ranges from 15% to 35% of project cost depending on location (urban/rural) and category (general/SC/ST/OBC/minorities/ex-servicemen). The beneficiary contributes 5–10% and the rest is a bank loan. Apply via the KVIC portal at kviconline.gov.in. The business must create employment — sole proprietorships are eligible.`,
  },
  {
    title: 'Sole Proprietorship vs OPC vs Private Limited Company',
    category: 'registration',
    tags: ['business structure', 'sole proprietorship', 'opc', 'pvt ltd', 'company registration'],
    content: `Sole Proprietorship: simplest structure, no separate registration needed (only shop act, GST, and trade license). No liability protection — personal assets at risk. Ideal for very small businesses. One Person Company (OPC): introduced to give solo entrepreneurs corporate structure with limited liability. Requires company registration with MCA at mcaportal.mca.gov.in. Minimum paid-up capital of ₹1 lakh. Can have only one director and one shareholder. Private Limited Company (Pvt Ltd): most credible structure for fundraising. Requires minimum 2 directors and 2 shareholders. Registered with MCA, annual compliance mandatory. Best for startups seeking investment or scaling significantly.`,
  },
  {
    title: 'Trade License — When and How to Get One',
    category: 'licensing',
    tags: ['trade license', 'shop act', 'municipal', 'local body'],
    content: `A trade license (also called shop and establishment license in many states) is issued by the local municipal corporation or panchayat. It is required for most businesses operating from a fixed premises — shops, restaurants, factories, service centres. The license must be renewed annually. Documents required typically include: proof of ownership or rent agreement for premises, PAN, Aadhaar, passport photo, and proof of business activity. Fee varies by city and business type. In Maharashtra the document is called Shops and Establishments Registration under the Maharashtra Shops and Establishments Act. Apply via your municipal corporation's online portal or visit the ward office.`,
  },
];

async function run() {
  console.log('Starting knowledge base ingestion...\n');

  await mongoose.connect(config.mongodburl, { serverSelectionTimeoutMS: 30000 });
  console.log('Connected to MongoDB\n');

  for (const doc of KNOWLEDGE_BASE) {
    process.stdout.write(`Ingesting: "${doc.title}"... `);
    try {
      const existing = await KnowledgeChunk.findOne({ title: doc.title });
      if (existing && existing.isEmbedded) {
        console.log('Already embedded. Skipping.');
        continue;
      }

      const chunk = existing || await KnowledgeChunk.create(doc);
      console.log("chunk",chunk)
      await ingestChunk(chunk._id, doc.title, doc.content, doc.category, doc.tags);
      console.log('Done ✓');
    } catch (error) {
      console.log(`FAILED — ${error.message}`);
    }
  }

  console.log('\nIngestion complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
