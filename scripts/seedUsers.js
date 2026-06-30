/**
 * Seed script: Individual users, Expert users, and Communities
 * for India's SMB ecosystem — legacy businesses, aspiring entrepreneurs,
 * upscale operators, and established businessmen turned advisors.
 *
 * Usage (from askbiz_backend/):
 *   node scripts/seedUsers.js           # insert (skip duplicates)
 *   node scripts/seedUsers.js --clear   # wipe seed data, then insert
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { config } = require("../utils/config");
const User = require("../src/models/users");
const { Individual, Expert } = require("../src/models/users");
const Community = require("../src/models/community");

const CLEAR = process.argv.includes("--clear");
const DEFAULT_PASSWORD = "AskBiz@123";

const CITIES = [
  { name: "Mumbai",        coords: [72.8777, 19.0760] },
  { name: "Delhi",         coords: [77.1025, 28.7041] },
  { name: "Bengaluru",     coords: [77.5946, 12.9716] },
  { name: "Hyderabad",     coords: [78.4867, 17.3850] },
  { name: "Chennai",       coords: [80.2707, 13.0827] },
  { name: "Pune",          coords: [73.8567, 18.5204] },
  { name: "Kolkata",       coords: [88.3639, 22.5726] },
  { name: "Ahmedabad",     coords: [72.5714, 23.0225] },
  { name: "Jaipur",        coords: [75.7873, 26.9124] },
  { name: "Lucknow",       coords: [80.9462, 26.8467] },
  { name: "Surat",         coords: [72.8311, 21.1702] },
  { name: "Indore",        coords: [75.8577, 22.7196] },
  { name: "Ludhiana",      coords: [75.8573, 30.9010] },
  { name: "Nagpur",        coords: [79.0882, 21.1458] },
  { name: "Coimbatore",    coords: [76.9558, 11.0168] },
  { name: "Kochi",         coords: [76.2673, 9.9312]  },
  { name: "Kanpur",        coords: [80.3319, 26.4499] },
  { name: "Rajkot",        coords: [70.8022, 22.3039] },
  { name: "Meerut",        coords: [77.7064, 28.9845] },
  { name: "Varanasi",      coords: [82.9739, 25.3176] },
  { name: "Amritsar",      coords: [74.8723, 31.6340] },
  { name: "Visakhapatnam", coords: [83.2185, 17.6868] },
  { name: "Tirupur",       coords: [77.3411, 11.1085] },
  { name: "Jodhpur",       coords: [73.0243, 26.2389] },
  { name: "Chandigarh",    coords: [76.7794, 30.7333] },
  { name: "Gurgaon",       coords: [77.0266, 28.4595] },
  { name: "Bhubaneswar",   coords: [85.8245, 20.2961] },
  { name: "Udaipur",       coords: [73.6833, 24.5854] },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function cityLocation(cityName) {
  const c = CITIES.find((x) => x.name === cityName) || CITIES[0];
  return {
    type: "Point",
    coordinates: [c.coords[0] + (Math.random() - 0.5) * 0.04, c.coords[1] + (Math.random() - 0.5) * 0.04],
    cityName: c.name,
  };
}

function dob(minAge, maxAge) {
  const year = new Date().getFullYear() - minAge - Math.floor(Math.random() * (maxAge - minAge));
  return new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
}

function phone() {
  const pfx = ["98","97","96","95","94","93","80","81","82","84","70","73","75","77","78","63","62","90","89","88","87","86","85"];
  return pick(pfx) + String(Math.floor(Math.random() * 100000000)).padStart(8, "0");
}

// ─── Individual Users ─────────────────────────────────────────────────────────
// Mix of: active SMB owners (traditional & upscale), aspiring entrepreneurs,
// employed people thinking of starting something, and curious explorers.
const INDIVIDUALS = [

  // ── Active small & traditional business owners ──
  { name: "Rameshbhai Patel",     username: "rameshbhai_patel_srt",  gender: "Male",   city: "Surat",        occupation: "Kirana Store Owner",           sector: "E-Commerce & Retail",       company: "Patel General Stores",      exp: "10+ years",  bio: "Running our family kirana since 1998. Now on WhatsApp ordering. Looking to expand to a second outlet." },
  { name: "Mohammed Aslam",       username: "md_aslam_lko",          gender: "Male",   city: "Lucknow",      occupation: "Kabab & Biryani Shop Owner",    sector: "Food & Beverages",          company: "Aslam Biryani House",       exp: "10+ years",  bio: "3rd generation seekh kabab and dum biryani in old Lucknow. Want to open a second branch." },
  { name: "Savitri Yadav",        username: "savitri_yadav_kan",     gender: "Female", city: "Kanpur",       occupation: "Mithai Shop Owner",             sector: "Food & Beverages",          company: "Yadav Sweets",              exp: "10+ years",  bio: "Khoya barfi and peda. Family recipe, no shortcuts. Festival season is when we shine." },
  { name: "Sukhdev Tiwari",       username: "sukhdev_tiwari_vns",    gender: "Male",   city: "Varanasi",     occupation: "Banarasi Silk Weaver",          sector: "Handicrafts & Artisans",    company: "Tiwari Handloom",           exp: "10+ years",  bio: "Pure Banarasi silk sarees on handloom. Our family weaves since 1960. Struggling with synthetic competition." },
  { name: "Gurpreet Sandhu",      username: "gurpreet_sandhu_ldh",   gender: "Male",   city: "Ludhiana",     occupation: "Hosiery Manufacturer",          sector: "Textiles & Apparel",        company: "Sandhu Hosiery Works",      exp: "10+ years",  bio: "Woollen knitwear manufacturer in Ludhiana. Thinking about direct-to-consumer." },
  { name: "Chandrabai Jadhav",    username: "chandrabai_jadhav",     gender: "Female", city: "Pune",         occupation: "Homemade Pickles & Papads",     sector: "Food & Beverages",          company: "Chandrabai's Home Foods",   exp: "5-8 years",  bio: "Maharashtrian pickles and papads. Selling at local haats. Want to take this online." },
  { name: "Kamalakar Nayak",      username: "kamalakar_nayak_bhu",   gender: "Male",   city: "Bhubaneswar",  occupation: "Wedding Tent & Decorator",      sector: "Media & Entertainment",     company: "Nayak Decorators",          exp: "8-10 years", bio: "Wedding and puja decoration contractor. Been doing this 12 years. Want to go upscale." },
  { name: "Dharmaraj Murugan",    username: "dharmaraj_murugan_tpr", gender: "Male",   city: "Tirupur",      occupation: "Knitwear Exporter",             sector: "Apparel Export",            company: "Murugan Knitwear",          exp: "10+ years",  bio: "T-shirts and innerwear from Tirupur's knitwear cluster. 18 years. Looking for new buyers." },
  { name: "Pushpa Nair",          username: "pushpa_nair_kochi",     gender: "Female", city: "Kochi",        occupation: "Spice Trader",                  sector: "Food & Beverages",          company: "Nair Spice House",          exp: "10+ years",  bio: "Pepper, cardamom and clove trader from Idukki. Trading at Kochi market for 15 years." },
  { name: "Balkrishna Patil",     username: "balkrishna_patil_nag",  gender: "Male",   city: "Nagpur",       occupation: "Civil Contractor",              sector: "Real Estate & Construction", company: "Patil Construction",        exp: "10+ years",  bio: "Small residential construction contractor in Nagpur. Bungalows and row houses." },
  { name: "Naresh Verma",         username: "naresh_verma_kan",      gender: "Male",   city: "Kanpur",       occupation: "Leather Goods Manufacturer",    sector: "Apparel Export",            company: "Verma Leather Works",       exp: "10+ years",  bio: "Leather wallets, belts, and bags. Kanpur leather district, 2nd generation." },
  { name: "Ranjit Singh Dhillon", username: "ranjit_dhillon_amt",    gender: "Male",   city: "Amritsar",     occupation: "Dhaba Owner",                   sector: "Food & Beverages",          company: "Dhillon Da Dhaba",          exp: "10+ years",  bio: "Amritsari kulcha and makke di roti. Open since 1989. My son wants to modernise it." },
  { name: "Jameel Ahmed",         username: "jameel_ahmed_mrt",      gender: "Male",   city: "Meerut",       occupation: "Sports Goods Manufacturer",     sector: "Sports & Fitness",          company: "Ahmed Sports",              exp: "10+ years",  bio: "Cricket bats and leather balls from Meerut's sports goods cluster. Family business." },
  { name: "Hira Bai Lodha",       username: "hira_bai_lodha_jai",    gender: "Female", city: "Jaipur",       occupation: "Bangles & Costume Jewellery",   sector: "Jewellery & Gems",          company: "Lodha Bangles",             exp: "8-10 years", bio: "Glass bangles and imitation jewellery from Jaipur's Bapu Bazaar." },
  { name: "Venkateswara Rao",     username: "venkat_rao_vsk",        gender: "Male",   city: "Visakhapatnam",occupation: "Fish Trader",                   sector: "Aquaculture & Fisheries",   company: "Rao Fish Traders",          exp: "10+ years",  bio: "Fish auctions at Visakha harbor. Supplying to hotels and cold storages." },

  // ── Upscale & premium business owners ──
  { name: "Nandini Rao",          username: "nandini_rao_blr",       gender: "Female", city: "Bengaluru",    occupation: "Boutique Hotel Owner",          sector: "Hospitality",               company: "The Nilgiri House",         exp: "8-10 years", bio: "Running a 12-room heritage boutique property in Coorg. High-end leisure travel." },
  { name: "Samir Khanna",         username: "samir_khanna_del",      gender: "Male",   city: "Delhi",        occupation: "Fine Dining Restaurant Owner",  sector: "Food & Beverages",          company: "Zaffran, GK-II",            exp: "10+ years",  bio: "Upscale North Indian fine dining in Greater Kailash. 10-year-old restaurant. Looking to franchise." },
  { name: "Preethi Suresh",       username: "preethi_suresh_chn",    gender: "Female", city: "Chennai",      occupation: "Luxury Saree Boutique",         sector: "Textiles & Apparel",        company: "Preethi Silks",             exp: "8-10 years", bio: "Kanchipuram silk and bridal sarees. High-end boutique in Anna Nagar catering to weddings." },
  { name: "Arjun Oberoi",         username: "arjun_oberoi_del",      gender: "Male",   city: "Delhi",        occupation: "Premium Car Dealership",        sector: "Automobiles",               company: "Oberoi Auto",               exp: "10+ years",  bio: "Pre-owned luxury cars — BMW, Mercedes, Audi. South Delhi clientele." },
  { name: "Kaveri Krishnaswamy",  username: "kaveri_krish_blr",      gender: "Female", city: "Bengaluru",    occupation: "Organic F&B Brand Owner",       sector: "Food & Beverages",          company: "Kaadu Organics",            exp: "5-8 years",  bio: "Artisan jams, cold-pressed oils, and millet snacks. Selling at farmer markets and online." },
  { name: "Rajiv Mehra",          username: "rajiv_mehra_mum",       gender: "Male",   city: "Mumbai",       occupation: "Interior Design Studio",        sector: "Furniture & Home Decor",    company: "Mehra Interiors",           exp: "10+ years",  bio: "High-end residential interior design in Mumbai. Bandra and Juhu clientele." },
  { name: "Anita Singhania",      username: "anita_singhania_kol",   gender: "Female", city: "Kolkata",      occupation: "Jewellery Designer & Retailer", sector: "Jewellery & Gems",          company: "Singhania Fine Jewels",     exp: "8-10 years", bio: "Contemporary gold and polki jewellery. Boutique in Park Street, Kolkata." },
  { name: "Vivek Kapur",          username: "vivek_kapur_chd",       gender: "Male",   city: "Chandigarh",   occupation: "Premium Catering & Events",     sector: "Food & Beverages",          company: "Kapur Hospitality",         exp: "10+ years",  bio: "High-end weddings and corporate events in Chandigarh and Panchkula. 500+ events done." },
  { name: "Meenakshi Pillai",     username: "meenakshi_pillai_kochi",gender: "Female", city: "Kochi",        occupation: "Heritage Homestay Owner",       sector: "Travel & Tourism",          company: "Pillai Heritage Homestay",  exp: "5-8 years",  bio: "Traditional tharavadu-style homestay near Alleppey backwaters. Boutique travel." },
  { name: "Siddharth Jain",       username: "siddharth_jain_ind",    gender: "Male",   city: "Indore",       occupation: "Café & Bakery Chain Owner",     sector: "Food & Beverages",          company: "The Flour & Grain",         exp: "5-8 years",  bio: "Artisan café and European bakery. 3 outlets in Indore. Looking at Bhopal next." },

  // ── Aspiring entrepreneurs — have an idea, researching or planning ──
  { name: "Aakash Sharma",        username: "aakash_sharma_del",     gender: "Male",   city: "Delhi",        occupation: "Government Employee",           sector: "Food & Beverages",          company: "Delhi Govt. (PWD)",         exp: "5-8 years",  bio: "Government job by day. Dreaming of opening a chai and paratha stall at night. Saving up." },
  { name: "Sunita Devi",          username: "sunita_devi_pat",       gender: "Female", city: "Varanasi",     occupation: "Homemaker",                     sector: "Handicrafts & Artisans",    company: "",                          exp: "0-2 years",  bio: "I make Madhubani art at home. People keep telling me to sell it. Wondering how to start." },
  { name: "Suraj Yadav",          username: "suraj_yadav_lko",       gender: "Male",   city: "Lucknow",      occupation: "Sales Executive",               sector: "E-Commerce & Retail",       company: "Bata India",                exp: "3-5 years",  bio: "Working in sales for 6 years. Want to open a footwear store of my own. Researching the market." },
  { name: "Varsha Tomar",         username: "varsha_tomar_gur",      gender: "Female", city: "Gurgaon",      occupation: "Teacher",                       sector: "Education & EdTech",        company: "Ryan International School", exp: "3-5 years",  bio: "Teaching for 8 years. Thinking of starting a home-based playschool. Looking for guidance." },
  { name: "Manish Dubey",         username: "manish_dubey_vns",      gender: "Male",   city: "Varanasi",     occupation: "Accountant",                    sector: "Real Estate & Construction", company: "Self (freelance)",          exp: "3-5 years",  bio: "Doing accounts for small shops. Want to start a tiffin service with my wife. Need to understand costing." },
  { name: "Hemlata Chouhan",      username: "hemlata_chouhan_ind",   gender: "Female", city: "Indore",       occupation: "Housewife",                     sector: "Beauty & Wellness",         company: "",                          exp: "0-2 years",  bio: "I've been doing mehendi at weddings for fun. Friends say I should charge. How do I make it a business?" },
  { name: "Pradeep Garg",         username: "pradeep_garg_mrr",      gender: "Male",   city: "Meerut",       occupation: "Retired Army Personnel",        sector: "Agriculture & Farming",     company: "",                          exp: "0-2 years",  bio: "Retired from the army. Got 2 acres near Meerut. Thinking of organic farming or a poultry unit." },
  { name: "Lakshmi Priya",        username: "lakshmi_priya_chn",     gender: "Female", city: "Chennai",      occupation: "Bank Employee",                 sector: "Food & Beverages",          company: "Indian Bank",               exp: "5-8 years",  bio: "My mother's sambar podi recipe is legendary. Want to package and sell it. Don't know where to start." },

  // ── Explorers — curious, evaluating options, no firm plan yet ──
  { name: "Ravi Shankar",         username: "ravi_shankar_nag",      gender: "Male",   city: "Nagpur",       occupation: "Truck Driver",                  sector: "Logistics & Supply Chain",  company: "Self-employed",             exp: "10+ years",  bio: "Been driving trucks for 15 years. Always wanted to own my own fleet. Just joined to learn how others did it." },
  { name: "Kavitha Nair",         username: "kavitha_nair_kochi",    gender: "Female", city: "Kochi",        occupation: "Nurse",                         sector: "Healthcare & Pharma",       company: "Amrita Hospital",           exp: "5-8 years",  bio: "Working in a hospital. My uncle wants me to take over his medical store. Not sure if I should." },
  { name: "Tarun Mishra",         username: "tarun_mishra_lko",      gender: "Male",   city: "Lucknow",      occupation: "Electrician",                   sector: "Gig & On-Demand Services",  company: "Self-employed",             exp: "5-8 years",  bio: "Doing electrical jobs in housing societies. Thinking about registering as a proper contractor. Exploring." },
  { name: "Geeta Rawat",          username: "geeta_rawat_del",       gender: "Female", city: "Delhi",        occupation: "Housewife",                     sector: "E-Commerce & Retail",       company: "",                          exp: "0-2 years",  bio: "My children are grown. I want to do something of my own now. Thinking about a small shop or online selling." },
  { name: "Santosh Gujar",        username: "santosh_gujar_pun",     gender: "Male",   city: "Pune",         occupation: "Construction Worker",           sector: "Real Estate & Construction", company: "Daily wage",               exp: "5-8 years",  bio: "Done construction work for 10 years. Want to become a small contractor. Looking for how to register." },
  { name: "Asha Kumari",          username: "asha_kumari_pat",       gender: "Female", city: "Varanasi",     occupation: "ASHA Worker",                   sector: "NGO & Social Enterprise",   company: "Bihar Govt.",               exp: "5-8 years",  bio: "Working as an ASHA health worker. Interested in starting a small pharmacy or medical store one day." },
  { name: "Deepak Shetty",        username: "deepak_shetty_mum",     gender: "Male",   city: "Mumbai",       occupation: "Security Guard",                sector: "E-Commerce & Retail",       company: "Topsgrup",                  exp: "3-5 years",  bio: "Sending money home to Karnataka every month. Thinking of starting something small in my hometown." },
  { name: "Pooja Verma",          username: "pooja_verma_jpr",       gender: "Female", city: "Jaipur",       occupation: "Beautician",                    sector: "Beauty & Wellness",         company: "Lakme Salon",               exp: "3-5 years",  bio: "Working at a salon for 5 years. Dream of opening my own parlour. Calculating if I can afford it." },
  { name: "Suresh Kumar Nair",    username: "suresh_kumar_nair",     gender: "Male",   city: "Kochi",        occupation: "Auto Rickshaw Driver",          sector: "Logistics & Supply Chain",  company: "Self-employed",             exp: "8-10 years", bio: "Running an auto for 10 years. Curious about starting a small taxi aggregator for my area. Just looking for now." },
  { name: "Mamta Singh",          username: "mamta_singh_del",       gender: "Female", city: "Delhi",        occupation: "Domestic Helper",               sector: "Gig & On-Demand Services",  company: "Self-employed",             exp: "5-8 years",  bio: "Working in 4 houses. Thinking of starting a cleaning agency with 2–3 women I know. First step unclear." },
  { name: "Rajiv Nambiar",        username: "rajiv_nambiar_blr",     gender: "Male",   city: "Bengaluru",    occupation: "Retired Teacher",               sector: "Education & EdTech",        company: "",                          exp: "0-2 years",  bio: "Retired after 30 years of teaching. Free time, some savings. Wondering if I can run a small tuition centre." },
  { name: "Fatima Shaikh",        username: "fatima_shaikh_mum",     gender: "Female", city: "Mumbai",       occupation: "Homemaker",                     sector: "Food & Beverages",          company: "",                          exp: "0-2 years",  bio: "Everyone loves my biryani at family gatherings. Thinking about a small home delivery business but nervous." },
];

// ─── Expert Users ─────────────────────────────────────────────────────────────
// Mix of: retired government/industry officials, practising consultants,
// established businessmen sharing experience, former business owners.
const EXPERTS = [
  // Established businessmen & former owners
  { name: "Mahavir Prasad Gupta",   username: "expert_mahavir_gupta",    gender: "Male",   city: "Indore",       title: "Grain Trader & Mandi Veteran",          sector: "Agriculture & Farming",      company: "Gupta Trading Co. (50 yrs)", exp: "30+ years", bio: "Our family has traded wheat and soybean at Indore mandi for 50 years. Happy to share what works.", detail: "Mahavir ran one of Indore mandi's largest arhatiya operations before handing it to his sons. He now mentors smaller traders on working capital discipline, seasonal pricing, warehouse receipts, and managing APMC relationships.", expertise: "Mandi Operations, Working Capital, APMC, Grain Grading" },
  { name: "Sulochana Rajagopalan",  username: "expert_sulochana_raja",   gender: "Female", city: "Coimbatore",   title: "Textile Mill Owner (Retd.)",             sector: "Textiles & Apparel",         company: "Rajagopalan Spinning Mills", exp: "35+ years", bio: "Built and ran a 5000-spindle cotton yarn mill for 35 years. Sold it, now sharing lessons.", detail: "Sulochana navigated every cotton cycle from 1985 to 2020. She advises small mills on power cost optimisation, yarn quality grading, TUFS loans, and the difference between surviving and growing in textile manufacturing.", expertise: "Cotton Yarn Manufacturing, TUFS, Power Loom Economics, Textile Cycles" },
  { name: "Hasmukh Mehta",          username: "expert_hasmukh_mehta",    gender: "Male",   city: "Surat",        title: "Diamond & Gems Trader (40 yrs)",         sector: "Jewellery & Gems",           company: "Mehta Diamond House",        exp: "40+ years", bio: "Started as a polisher in 1982. Retired as one of Surat's known rough stone traders.", detail: "Hasmukh has seen every diamond cycle from rough import to export. He guides young polishers and traders on price benchmarking, factory compliance for export, hallmarking norms, and negotiating with Mumbai wholesalers.", expertise: "Diamond Polishing, Rough Stone Trading, Export Compliance, Hallmarking" },
  { name: "Jagdish Prasad Tiwari",  username: "expert_jagdish_tiwari",   gender: "Male",   city: "Varanasi",     title: "Banarasi Saree Manufacturer & Exporter", sector: "Textiles & Apparel",         company: "Tiwari Silk House",          exp: "35+ years", bio: "Three generations in Banarasi silk. Built a small export business. Now mentoring younger weavers.", detail: "Jagdish built a direct-export channel to boutiques in USA and UK from his Varanasi workshop. He helps young weaver-entrepreneurs understand GI tag benefits, buyer quality expectations, and pricing for exports.", expertise: "Silk Weaving, Banarasi GI, Handloom Export, Buyer Relations" },
  { name: "Shardaben Patel",        username: "expert_shardaben_patel",  gender: "Female", city: "Ahmedabad",    title: "Kirana Chain Owner (Retd.)",             sector: "E-Commerce & Retail",        company: "Patel Provision Stores (12 outlets)", exp: "30+ years", bio: "Grew from a single kirana to 12 outlets before retiring. Share what I know freely.", detail: "Shardaben built Gujarat's small-town provision retail before modern trade arrived. She advises kirana owners on supplier negotiation, cash management, managing credit to customers, and when (and whether) to expand.", expertise: "Kirana Retail, Supplier Terms, Credit Management, Multi-Outlet Ops" },
  { name: "Captain Harinder Bedi",  username: "expert_harinder_bedi",    gender: "Male",   city: "Amritsar",     title: "Transport Fleet Owner (Retd.)",          sector: "Logistics & Supply Chain",   company: "Bedi Roadways",              exp: "30+ years", bio: "Started with one truck in 1990. Grew to 40 trucks. Sold the fleet. Here to help others.", detail: "Captain Bedi navigated permits, fuel costs, driver management, and freight rate cycles for 30 years. He advises small truck owners on route economics, load sourcing, FASTag, and whether to stay owner-operator or build a fleet.", expertise: "Trucking Operations, Fleet Management, Freight Contracts, FASTag" },
  { name: "Meera Krishnan",         username: "expert_meera_krishnan",   gender: "Female", city: "Chennai",      title: "Catering Business Owner (Retd.)",        sector: "Food & Beverages",           company: "Meera Grand Caterers",       exp: "25+ years", bio: "Started with 50-plate orders from home. Retired after doing 1000-plate corporate banquets.", detail: "Meera built a commercial catering operation serving corporate canteens, weddings, and temple events in Chennai. She coaches new caterers on kitchen layout, FSSAI compliance, staff management, and tender bidding.", expertise: "Catering Operations, FSSAI, Kitchen Management, Event Catering" },
  { name: "Bhupinder Khurana",      username: "expert_bhupinder_khurana",gender: "Male",   city: "Ludhiana",     title: "Hosiery Manufacturer & Exporter",        sector: "Textiles & Apparel",         company: "Khurana Woollens (Est. 1978)", exp: "40+ years", bio: "40 years of making woollen knitwear. Know every buyer from Dubai to Canada.", detail: "Bhupinder's family unit exports to 20 countries. He mentors other Ludhiana hosiery units on export documentation, BIS certification, quality rejections from foreign buyers, and transitioning from job work to own brand.", expertise: "Hosiery Export, BIS Certification, Buyer Relations, Own Brand" },
  { name: "Rukhsana Begum",         username: "expert_rukhsana_begum",   gender: "Female", city: "Lucknow",      title: "Chikankari Business Owner",              sector: "Handicrafts & Artisans",     company: "Rukhsana Chikan House",      exp: "25+ years", bio: "Grew a home-based embroidery unit to a 300-worker chikankari brand. Still going.", detail: "Rukhsana expanded from stitching sarees at home to supplying Delhi, Mumbai, and export boutiques. She coaches women entrepreneurs on pricing handmade work, managing artisan karigars, and accessing government craft schemes.", expertise: "Chikankari Business, Artisan Management, Craft Export, EPCH" },
  { name: "Satish Agarwal",         username: "expert_satish_agarwal",   gender: "Male",   city: "Delhi",        title: "Hardware & Building Materials Trader",   sector: "Real Estate & Construction", company: "Agarwal Hardware (Est. 1975)", exp: "40+ years", bio: "50-year-old hardware shop in Paharganj. Seen Delhi's construction market transform.", detail: "Satish has supplied cement, pipes, tiles, and fittings to Delhi's builders for four decades. He guides hardware traders and building material suppliers on supplier credit, managing contractor defaults, and moving from counter sales to project supply.", expertise: "Building Materials Trade, Contractor Supply, Supplier Credit, Inventory" },

  // Practising consultants with on-ground SMB focus
  { name: "Ramakant Shukla",        username: "expert_ramakant_shukla",  gender: "Male",   city: "Varanasi",     title: "Handloom & GI Products Advisor",         sector: "Handicrafts & Artisans",     company: "Varanasi Handloom Dev. Board (Retd.)", exp: "25+ years", bio: "Retired govt. advisor. 30 years helping Banarasi handloom weavers survive and grow.", detail: "Ramakant helped 300+ weaver families get GI certification, PMEGP loans, and market access. Now consults independently on government schemes, design intervention, and connecting artisans to urban buyers.", expertise: "Handloom GI, PMEGP, Weaver Welfare, Mudra Loans" },
  { name: "Savitaben Patel",         username: "expert_savitaben_patel",  gender: "Female", city: "Ahmedabad",    title: "MSME Credit & Mudra Loan Consultant",    sector: "Banking & Finance",          company: "SIDBI (Retd.)",              exp: "22+ years", bio: "Ex-SIDBI officer. Helped 500+ small business owners access their first formal loan.", detail: "Savitaben now runs a one-woman consultancy helping first-generation borrowers prepare bankable proposals, navigate Mudra and CGTMSE schemes, and build a clean credit history from scratch.", expertise: "Mudra Loans, CGTMSE, MSME Credit, Bank Liaison" },
  { name: "Nandkishore Tiwari",      username: "expert_nandkishore",      gender: "Male",   city: "Kanpur",       title: "Leather Industry Consultant",            sector: "Apparel Export",             company: "Council for Leather Exports", exp: "25+ years", bio: "Leather tanning and finished goods consultant for Kanpur-Agra cluster.", detail: "Nandkishore helps small leather units with REACH compliance, effluent treatment requirements, buyer audits, and CLE export incentives. Knows every tannery in Jajmau.", expertise: "Leather Export, REACH, CLE Incentives, Tannery Compliance" },
  { name: "Usha Venkataraman",       username: "expert_usha_venkat",      gender: "Female", city: "Coimbatore",   title: "Power Loom & Textile Advisor",           sector: "Textiles & Apparel",         company: "SIMA (Consultant)",          exp: "22+ years", bio: "SIMA textile association advisor. Cotton to cloth costing and compliance.", detail: "Usha has guided 100+ power loom units on TUFS applications, yarn procurement strategy, and energy efficiency. Helped units transition from job work to their own fabric brand.", expertise: "TUFS, Power Loom, Cotton Procurement, Textile Costing" },
  { name: "Lalitha Prabhakar",       username: "expert_lalitha_prabhakar",gender: "Female", city: "Chennai",      title: "Food Safety & FSSAI Consultant",         sector: "Food & Beverages",           company: "Self (ex-FICCI FoodPro)",    exp: "15+ years", bio: "FSSAI licensing and food safety compliance for small food businesses.", detail: "Lalitha has walked 200+ small food manufacturers, home kitchens, and dhabas through FSSAI registration, labelling norms, and hygiene inspections. Specialises in the first-time licencing journey.", expertise: "FSSAI Licensing, Food Safety, Labelling, Home Kitchen Compliance" },
  { name: "Ravindra Kadam",          username: "expert_ravindra_kadam",   gender: "Male",   city: "Pune",         title: "MSME Compliance Consultant",             sector: "Manufacturing",              company: "MCCIA (Consultant)",         exp: "20+ years", bio: "Factory licences, pollution NOC, Udyam registration for Pune-belt manufacturers.", detail: "Ravindra has resolved 100+ MIDC show-cause notices and guided small manufacturers through factory act compliance, GST audits, and government scheme applications.", expertise: "Factory Act, Udyam Registration, MIDC, GST Audit" },
  { name: "Zubeda Khatoon",          username: "expert_zubeda_khatoon",   gender: "Female", city: "Lucknow",      title: "Craft Export & Buyer Sourcing",          sector: "Handicrafts & Artisans",     company: "EPCH (Consultant)",          exp: "18+ years", bio: "EPCH consultant. Connecting Lucknow chikankari units to overseas buyers.", detail: "Zubeda has helped hundreds of small chikankari units get EPCH registration, prepare buyer-ready samples, and close orders with boutiques in the US, UK, and GCC.", expertise: "Chikankari Export, EPCH, Fair Trade, Buyer Sourcing" },
  { name: "Ghanshyam Das",           username: "expert_ghanshyam_das",    gender: "Male",   city: "Kolkata",      title: "Jute Industry Expert",                   sector: "Textiles & Apparel",         company: "IJMA (Consultant)",          exp: "25+ years", bio: "Indian Jute Mills Association advisor. Green packaging transition.", detail: "Ghanshyam helps small jute units near Hooghly transition from traditional orders to eco-packaging markets, including EU plastic-replacement contracts and jute handicraft exports.", expertise: "Jute Manufacturing, Eco Packaging, IJMA, Export Compliance" },
  { name: "Bhagwati Devi",           username: "expert_bhagwati_devi",    gender: "Female", city: "Jaipur",       title: "Women SHG & Micro Enterprise Advisor",   sector: "NGO & Social Enterprise",    company: "RSLM (Retd.)",               exp: "18+ years", bio: "Rajasthan State Livelihood Mission. Formed 600+ SHGs across Barmer and Jodhpur.", detail: "Bhagwati helps rural women access NRLM funds, identify income-generating activities, and build sustainable micro-enterprises beyond SHG savings.", expertise: "SHG, NRLM, Women Microenterprise, Rural Livelihood" },
  { name: "Aslam Qureshi",           username: "expert_aslam_qureshi",    gender: "Male",   city: "Meerut",       title: "Sports Goods Industry Expert",           sector: "Sports & Fitness",           company: "SGEPC (Consultant)",         exp: "20+ years", bio: "Meerut sports goods cluster. Cricket, hockey, and football manufacturing.", detail: "Aslam advises small Meerut sports good units on MRP labelling, ISI marks, export to East Africa and Australia, and SGEPC incentive schemes.", expertise: "Sports Goods Manufacturing, ISI Certification, SGEPC, Export" },
  { name: "Prakash Nanaware",        username: "expert_prakash_nanaware", gender: "Male",   city: "Nagpur",       title: "Cotton & Agri Commodity Expert",         sector: "Agriculture & Farming",      company: "CCI (Retd.)",                exp: "25+ years", bio: "Cotton Corporation of India procurement officer. Vidarbha cotton cluster.", detail: "Prakash assists cotton farmers and ginners with CCI procurement, grading, moisture testing, and crop insurance. Understands the full Vidarbha agri-distress context.", expertise: "Cotton Procurement, CCI, Crop Insurance, Ginning" },
  { name: "Radhakrishnan Pillai",    username: "expert_radhakrishnan",    gender: "Male",   city: "Kochi",        title: "Fisheries Export & MPEDA Consultant",    sector: "Aquaculture & Fisheries",    company: "MPEDA (Retd.)",              exp: "22+ years", bio: "Ex-MPEDA. Helping fishing co-ops get certified and start exporting.", detail: "Radhakrishnan has helped 50+ fishing cooperatives in Kerala secure MPEDA certification, IQF cold storage access, and shrimp/fish export licences to EU and Japan.", expertise: "Fisheries Export, MPEDA, Cold Chain, Fishing Co-ops" },
  { name: "Bahadur Singh Rawat",     username: "expert_bahadur_rawat",    gender: "Male",   city: "Delhi",        title: "Road Transport & Trucking Advisor",      sector: "Logistics & Supply Chain",   company: "AIMTC (Consultant)",         exp: "25+ years", bio: "AIMTC advisor. Fleet operators and small transporters across North India.", detail: "Bahadur assists small truck operators with permits, FASTag compliance, route economics, and transitioning from single-truck to small fleet operations.", expertise: "Road Transport, AIMTC, Fleet Management, FASTag" },
  { name: "Kamakshi Subramanian",    username: "expert_kamakshi_sub",     gender: "Female", city: "Tirupur",      title: "Knitwear Export Compliance Expert",      sector: "Apparel Export",             company: "AEPC South Chapter",         exp: "20+ years", bio: "Tirupur knitwear export — documentation, compliance audits, costing.", detail: "Kamakshi handles pre-shipment documentation, SA8000/SMETA social audits, and costing for 60+ small knitwear exporters in Tirupur.", expertise: "Knitwear Export, SA8000, SMETA, Costing" },
  { name: "Bindeshwari Devi",        username: "expert_bindeshwari_devi", gender: "Female", city: "Varanasi",     title: "Temple Economy & Religious Tourism",     sector: "Travel & Tourism",           company: "Kashi Vishwanath Trust (Consultant)", exp: "15+ years", bio: "Religious tourism and the puja economy of Varanasi. Ghat-side business advisor.", detail: "Bindeshwari advises prasad shops, panda guilds, flower sellers, and boat operators in Varanasi's temple economy on formalisation, digital payments, and seasonal business planning.", expertise: "Religious Tourism, Temple Economy, Panda Networks, Digital Payments" },
  { name: "Jayaram Hegde",           username: "expert_jayaram_hegde",    gender: "Male",   city: "Bengaluru",    title: "Plantation Crops & Horticulture",        sector: "Agriculture & Farming",      company: "CPC Karnataka (Retd.)",      exp: "20+ years", bio: "Coconut, arecanut, and coffee plantation advisor from coastal Karnataka.", detail: "Jayaram assists small plantation holders on soil management, post-harvest processing, and accessing plantation development board subsidies.", expertise: "Plantation Crops, CPC Subsidies, Arecanut, Post-Harvest" },
  { name: "Amina Siddiqui",          username: "expert_amina_siddiqui",   gender: "Female", city: "Hyderabad",    title: "Catering & Events Business Consultant",  sector: "Food & Beverages",           company: "Hyderabad Catering Guild",   exp: "18+ years", bio: "Scaling small catering businesses into reliable event anchors in Hyderabad.", detail: "Amina advises small halal catering units on kitchen licensing, capacity planning for wedding seasons, and securing contracts with hotels and sabha halls.", expertise: "Catering Operations, FSSAI, Event Catering, Halal Compliance" },
  { name: "Sohan Lal Sharma",        username: "expert_sohan_lal",        gender: "Male",   city: "Jaipur",       title: "Jewellery & Gem Trade Advisor",          sector: "Jewellery & Gems",           company: "GJEPCI (Consultant)",        exp: "30+ years", bio: "30 years in Jaipur gems. Rough stone to finished jewellery supply chain.", detail: "Sohan Lal helps small Jaipur jewellers and gem cutters access export markets, BIS hallmarking, and jewellery park benefits.", expertise: "Gem Trade, Hallmarking, GJEPCI, Jewellery Export" },
  { name: "Noor Mohammed",           username: "expert_noor_mohammed",    gender: "Male",   city: "Hyderabad",    title: "Hyderabad Pearls & Silver Craft",        sector: "Jewellery & Gems",           company: "Hyderabad Pearl Traders Assoc.", exp: "25+ years", bio: "Old city pearl and silver trade. Advising next-gen merchants on modernising.", detail: "Noor Mohammed advises Hyderabadi pearl merchants and silver craftsmen on hallmarking, GCC export paperwork, and moving from street trade to formal retail.", expertise: "Pearl Trade, Silver Craft, Hallmarking, GCC Export" },
];

// ─── Communities ──────────────────────────────────────────────────────────────
const COMMUNITIES = [
  { name: "Surat Textile Traders Forum",        username: "surat_textile_traders",      type: "public",  city: "Surat",        desc: "Saree, fabric, and dress material traders of Surat. Daily market rates, buyer inquiries, and transport updates.", interests: [{ interestType: "sector", value: ["Textiles & Apparel"] }] },
  { name: "Ludhiana Hosiery Manufacturers",     username: "ldh_hosiery_mfr",            type: "public",  city: "Ludhiana",     desc: "Knitwear and hosiery manufacturers from Ludhiana's industrial belt. Labour rates, raw material prices, compliance.", interests: [{ interestType: "sector", value: ["Textiles & Apparel", "Manufacturing"] }] },
  { name: "Varanasi Weavers & Silk Traders",    username: "varanasi_weavers",           type: "public",  city: "Varanasi",     desc: "Banarasi saree weavers, silk traders, and zari workers. GI protection, market rates, and EPCH updates.", interests: [{ interestType: "sector", value: ["Handicrafts & Artisans", "Textiles & Apparel"] }] },
  { name: "Jaipur Artisans & Jewellers",        username: "jaipur_artisans_jewellers",  type: "public",  city: "Jaipur",       desc: "Blue pottery, block print, stonework, and gem jewellery artisans of Jaipur sharing craft knowledge and buyers.", interests: [{ interestType: "sector", value: ["Handicrafts & Artisans", "Jewellery & Gems"] }] },
  { name: "Hyderabad Food & Catering Network",  username: "hyd_food_catering",          type: "public",  city: "Hyderabad",    desc: "Dhabas, biryani shops, wedding caterers, and tiffin services across Hyderabad. FSSAI, event rates, and market talk.", interests: [{ interestType: "sector", value: ["Food & Beverages"] }] },
  { name: "Kerala Spice & Plantation Traders",  username: "kerala_spice_traders",       type: "public",  city: "Kochi",        desc: "Cardamom, pepper, clove, and rubber traders from Kerala connecting with buyers and daily market news.", interests: [{ interestType: "sector", value: ["Agriculture & Farming", "Food & Beverages"] }] },
  { name: "Kanpur Leather Business Circle",     username: "kanpur_leather_circle",      type: "public",  city: "Kanpur",       desc: "Tanneries, leather goods makers, and finished product exporters from Kanpur and Agra cluster.", interests: [{ interestType: "sector", value: ["Apparel Export", "Manufacturing"] }] },
  { name: "Mumbai Kirana & Provision Stores",   username: "mumbai_kirana_network",      type: "public",  city: "Mumbai",       desc: "Kirana and provision store owners across Mumbai discussing supplier rates, credit terms, and delivery.", interests: [{ interestType: "sector", value: ["E-Commerce & Retail", "Food & Beverages"] }] },
  { name: "Tirupur Knitwear Exporters",         username: "tirupur_knitwear",           type: "public",  city: "Tirupur",      desc: "Knitwear manufacturers and exporters from Tirupur. Buyer leads, compliance documentation, shipping rates.", interests: [{ interestType: "sector", value: ["Apparel Export", "Textiles & Apparel"] }] },
  { name: "Indore Mandi & Grain Traders",       username: "indore_mandi_traders",       type: "public",  city: "Indore",       desc: "Wheat, soybean, and dal traders from Madhya Pradesh's largest agricultural mandi.", interests: [{ interestType: "sector", value: ["Agriculture & Farming"] }] },
  { name: "I Want to Start a Business — India", username: "start_biz_india",            type: "public",  city: "Delhi",        desc: "For anyone thinking of starting a small business in India. Ask anything — licensing, money, ideas, first steps.", interests: [{ interestType: "sector", value: ["E-Commerce & Retail", "Food & Beverages", "Consulting & Professional Services"] }] },
  { name: "MSME Loans & Government Schemes",    username: "msme_loans_schemes",         type: "public",  city: "Delhi",        desc: "Mudra, PMEGP, CGTMSE, state schemes — helping small business owners find and apply for the right funding.", interests: [{ interestType: "sector", value: ["Banking & Finance"] }] },
  { name: "Home-Based Food Business India",     username: "home_food_biz_india",        type: "public",  city: "Mumbai",       desc: "Tiffin services, pickles, baked goods, and cloud kitchens run from home. Growth, FSSAI, and pricing advice.", interests: [{ interestType: "sector", value: ["Food & Beverages"] }] },
  { name: "Delhi NCR Auto Workshops & Dealers", username: "delhi_auto_workshops",       type: "public",  city: "Delhi",        desc: "Car and two-wheeler repair garages, spare part traders, and small dealerships across Delhi-NCR.", interests: [{ interestType: "sector", value: ["Automobiles"] }] },
  { name: "Punjab Agri & Dairy Farmers",        username: "punjab_agri_dairy",          type: "public",  city: "Amritsar",     desc: "Wheat, paddy, and dairy farmers from Punjab sharing mandi prices, APMC news, and crop tips.", interests: [{ interestType: "sector", value: ["Agriculture & Farming", "Dairy & Cattle"] }] },
  { name: "South India Fisheries Network",      username: "south_india_fisheries",      type: "public",  city: "Kochi",        desc: "Fishing cooperatives, fish traders, and cold storage operators from Kerala, Tamil Nadu, and Andhra coast.", interests: [{ interestType: "sector", value: ["Aquaculture & Fisheries"] }] },
  { name: "Boutique Hotels & Homestays India",  username: "boutique_hotels_homestays",  type: "public",  city: "Bengaluru",    desc: "Independent hotel and homestay owners discussing occupancy, OTA commissions, pricing, and guest experience.", interests: [{ interestType: "sector", value: ["Hospitality", "Travel & Tourism"] }] },
  { name: "Upscale Restaurants & Cafés India",  username: "upscale_restaurants_india",  type: "public",  city: "Mumbai",       desc: "Fine dining, premium café, and high-end restaurant owners. Talent, food cost, GST on F&B, and expansion.", interests: [{ interestType: "sector", value: ["Food & Beverages", "Hospitality"] }] },
  { name: "Coimbatore Industrial Manufacturers",username: "coimbatore_industry",        type: "public",  city: "Coimbatore",   desc: "Pumps, motors, textile machinery, and foundry units from Coimbatore's manufacturing belt.", interests: [{ interestType: "sector", value: ["Manufacturing", "Textiles & Apparel"] }] },
  { name: "Indian Wedding & Events Contractors",username: "wedding_event_contractors",  type: "public",  city: "Jaipur",       desc: "Tent decorators, caterers, band-baja, photo studios. India's large and unorganised wedding industry.", interests: [{ interestType: "sector", value: ["Media & Entertainment", "Food & Beverages"] }] },
  { name: "Small Construction Contractors",     username: "small_contractors_india",    type: "public",  city: "Pune",         desc: "Residential civil contractors, tile fitters, plumbers, and building material suppliers.", interests: [{ interestType: "sector", value: ["Real Estate & Construction"] }] },
  { name: "Women-Led Businesses India",         username: "women_led_biz_india",        type: "public",  city: "Mumbai",       desc: "Women running or planning businesses — traditional, home-based, or upscale. Advice, money, confidence, community.", interests: [{ interestType: "sector", value: ["NGO & Social Enterprise", "E-Commerce & Retail"] }] },
  { name: "Kolkata Wholesale Traders Guild",    username: "kol_wholesale_guild",        type: "public",  city: "Kolkata",      desc: "Burrabazar and Metiabruz traders — textiles, jute, grocery, and electrical goods. Old trade, new markets.", interests: [{ interestType: "sector", value: ["E-Commerce & Retail", "Textiles & Apparel"] }] },
  { name: "Rajkot & Saurashtra SME Manufacturers",username: "rajkot_sme_circle",       type: "public",  city: "Rajkot",       desc: "Engineering, casting, and small manufacturers from Rajkot, Morbi, and Bhavnagar clusters.", interests: [{ interestType: "sector", value: ["Manufacturing", "Automobiles"] }] },
  { name: "Meerut Sports & Craft Cluster",      username: "meerut_cluster",             type: "public",  city: "Meerut",       desc: "Sports goods, scissor makers, and brassware artisans from Meerut's legacy industry clusters.", interests: [{ interestType: "sector", value: ["Sports & Fitness", "Handicrafts & Artisans"] }] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dob(minAge, maxAge) {
  const year = new Date().getFullYear() - minAge - Math.floor(Math.random() * (maxAge - minAge));
  return new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
}

async function seed() {
  await mongoose.connect(config.mongodburl, { serverSelectionTimeoutMS: 30000 });
  console.log("✅ MongoDB connected");

  const hashedPw = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  if (CLEAR) {
    const del = await User.deleteMany({
      username: { $in: [...INDIVIDUALS.map(u => u.username), ...EXPERTS.map(u => u.username)] },
    });
    console.log(`🗑  Removed ${del.deletedCount} seed users`);
    const cdel = await Community.deleteMany({
      communityUsername: { $in: COMMUNITIES.map(c => c.username) },
    });
    console.log(`🗑  Removed ${cdel.deletedCount} seed communities`);
  }

  // Individuals
  let indOk = 0;
  for (const u of INDIVIDUALS) {
    try {
      await Individual.create({
        username: u.username, email: `${u.username}@askbiz.in`, password: hashedPw,
        phoneNumber: phone(), accountType: "Individual", status: "active",
        phoneNumberVerified: true, emailVerified: true, communityGuidelines: true,
        provider: "own", countryFlag: "🇮🇳", countryCode: "+91",
        location: cityLocation(u.city),
        interest: [{ interestType: "businessCategory", value: [u.sector] }],
        name: u.name, dob: dob(22, 62), gender: u.gender, shortBio: u.bio,
        occupationTitle: u.occupation, occupationSector: u.sector,
        workExperience: u.exp, companyName: u.company || "",
      });
      indOk++;
    } catch (e) {
      if (e.code === 11000) process.stdout.write(".");
      else console.error(`\n❌ ${u.username}: ${e.message}`);
    }
  }
  console.log(`\n✅ Individuals: ${indOk}/${INDIVIDUALS.length}`);

  // Experts
  let expOk = 0;
  for (const u of EXPERTS) {
    try {
      await Expert.create({
        username: u.username, email: `${u.username}@askbiz.in`, password: hashedPw,
        phoneNumber: phone(), accountType: "Expert", status: "active",
        phoneNumberVerified: true, emailVerified: true, communityGuidelines: true,
        provider: "own", countryFlag: "🇮🇳", countryCode: "+91",
        location: cityLocation(u.city),
        interest: [{ interestType: "businessCategory", value: [u.sector] }],
        name: u.name, dob: dob(38, 70), gender: u.gender,
        shortBio: u.bio, detailBio: u.detail,
        occupationTitle: u.title, occupationSector: u.sector,
        workExperience: u.exp, companyName: u.company,
        expertise: u.expertise, adminApproval: "approved", blueTick: true,
      });
      expOk++;
    } catch (e) {
      if (e.code === 11000) process.stdout.write(".");
      else console.error(`\n❌ ${u.username}: ${e.message}`);
    }
  }
  console.log(`✅ Experts: ${expOk}/${EXPERTS.length}`);

  // Communities
  const owners = await User.find({
    username: { $in: [...INDIVIDUALS.map(u => u.username), ...EXPERTS.map(u => u.username)] },
  }).select("_id");

  let comOk = 0;
  for (const c of COMMUNITIES) {
    try {
      await Community.create({
        userId: pick(owners)._id, communityName: c.name,
        communityUsername: c.username, communityType: c.type,
        location: cityLocation(c.city), interest: c.interests,
        description: c.desc, status: "active",
      });
      comOk++;
    } catch (e) {
      if (e.code === 11000) process.stdout.write(".");
      else console.error(`\n❌ ${c.username}: ${e.message}`);
    }
  }
  console.log(`✅ Communities: ${comOk}/${COMMUNITIES.length}`);

  console.log("\n─────────────────────────────────────────");
  console.log(`  Individuals : ${indOk}`);
  console.log(`  Experts     : ${expOk}`);
  console.log(`  Communities : ${comOk}`);
  console.log(`  Password    : ${DEFAULT_PASSWORD}`);
  console.log("─────────────────────────────────────────");

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
