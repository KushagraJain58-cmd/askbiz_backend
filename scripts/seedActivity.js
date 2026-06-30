/**
 * Seed script: Posts, Comments, Replies, Likes, and Community Members
 * Simulates realistic activity from existing seed users.
 *
 * Usage (from askbiz_backend/):
 *   node scripts/seedActivity.js           # insert
 *   node scripts/seedActivity.js --clear   # wipe seed activity, then insert
 *
 * Requires seedUsers.js to have been run first.
 */

const mongoose = require("mongoose");
const { config } = require("../utils/config");
const User = require("../src/models/users");
const Community = require("../src/models/community");
const CommunityMember = require("../src/models/communityMembers");
const Post = require("../src/models/post");
const Comment = require("../src/models/comment");
const Reply = require("../src/models/reply");
const Like = require("../src/models/like");

const CLEAR = process.argv.includes("--clear");

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, Math.min(n, arr.length));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── Post definitions ─────────────────────────────────────────────────────────
// Each post: { authorUsername, title, description, tags, interest, isQuery, communityUsername?, type }
// type: 'normal' | 'community'
// ~60% FnB, rest spread across categories, a few spam/ads

const POST_DEFS = [

  // ══ FOOD & BEVERAGES (majority) ══════════════════════════════════════════

  // Queries from aspiring / exploring individuals
  {
    authorUsername: "fatima_shaikh_mum",
    title: "Behen log — ghar se biryani delivery shuru karna chahti hoon. Kahan se shuru karein?",
    description: "Mera ghar ka biryani sabko pasand hai. Sochti hoon proper delivery shuru karein Malad area mein. FSSAI kab chahiye? Koi basic guidance de sakta hai? Pehle wali post mein kisi ne bola tha basic registration se chal jata hai ghar ke liye.",
    tags: ["biryani", "homedelivery", "fssai", "ghar-se-business"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: true,
    communityUsername: "home_food_biz_india",
    type: "community",
  },
  {
    authorUsername: "lakshmi_priya_chn",
    title: "Amma's sambar podi — packaging and selling it. Where do I start?",
    description: "My mother's sambar podi is genuinely different — roasted cumin, homemade, stone-ground. People who've tried it keep asking where to buy. I want to package it properly and sell online or at stores. What are the steps? FSSAI, packaging design, pricing — feeling overwhelmed.",
    tags: ["sambar", "spice", "packaging", "fssai", "homemade"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: true,
    type: "normal",
  },
  {
    authorUsername: "hemlata_chouhan_ind",
    title: "Mehendi se thoda zyada — catering bhi add kar sakti hoon kya?",
    description: "Main mehendi lagati hoon functions mein. Kuch clients kehte hain ki unhe ghar ka khana bhi chahiye chhoti parties ke liye. Kya ek hi licence se dono ho sakta hai? Ya alag alag registration chahiye?",
    tags: ["mehendi", "catering", "smallbusiness"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: true,
    communityUsername: "home_food_biz_india",
    type: "community",
  },
  {
    authorUsername: "manish_dubey_vns",
    title: "Tiffin service ke liye ek din mein kitne boxes profitable hota hai?",
    description: "Main aur meri patni Varanasi mein tiffin service shuru karna chahte hain. Humne basic calculation ki — ek box mein ~₹60 cost, ₹120 rate. 50 boxes se shuru karein toh kya fixed cost nikalega? Kisi ne yeh kiya hoga toh bata dein.",
    tags: ["tiffin", "profitability", "varanasi", "foodbusiness"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: true,
    communityUsername: "hyd_food_catering",
    type: "community",
  },

  // Info / experience sharing from business owners
  {
    authorUsername: "md_aslam_lko",
    title: "30 saal mein jo seekha — biryani business ke 5 asli rules",
    description: "1. Dum pakao, jaldi mat karo — taste mein fark padta hai.\n2. Rice ki quality mat todna kabhi, chahe cost badhey.\n3. Pehle 3 saal mein profit mat dhundho — naam bana lo.\n4. Staff ko khilao pehle, baad mein customer ko.\n5. WhatsApp group se zyada effective koi marketing nahi hai apne mohalle mein.\n\nYeh rules 1994 se aaj tak kaam karte hain. Naya koi add karna chahega?",
    tags: ["biryani", "fnb", "businesstips", "lucknow", "legacy"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "hyd_food_catering",
    type: "community",
  },
  {
    authorUsername: "ranjit_dhillon_amt",
    title: "Amritsari dhaba — how we survived when the highway shifted",
    description: "In 2018 the new bypass road meant 80% of our truck traffic disappeared overnight. We almost shut down. What saved us: switched focus to local Amritsar families, added home delivery (which we never did before), tied up with a few wedding caterers to supply dal makhani in bulk. Revenue is actually higher now than before the bypass. Sometimes crisis forces the right move.",
    tags: ["dhaba", "roadside", "survival", "amritsar", "adaptation"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "hyd_food_catering",
    type: "community",
  },
  {
    authorUsername: "savitri_yadav_kan",
    title: "Diwali order rush — how we managed 800 kg mithai in 4 days with 3 people",
    description: "Every Diwali we panic and every Diwali we somehow manage. This year we pre-took 60% of orders by Navratri itself and collected advance. Remaining 40% walk-ins we cap at 11am. The advance system changed our life — we don't have unsold stock anymore. Anyone else doing advance bookings for seasonal sweets?",
    tags: ["mithai", "diwali", "sweets", "operations", "seasonalbusiness"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    type: "normal",
  },
  {
    authorUsername: "chandrabai_jadhav",
    title: "Pehli online order aayi! Pune se bahar bhi jaata hai mera achaar 🙏",
    description: "Maine ek hafte pehle Instagram page banaya. Aaj Nashik se order aaya. Mujhe vishwaas nahi ho raha. Jab Didi ne bola ki online dalo toh mujhe lagta tha kaun kharidega. Packaging karke bhej diya courier se. Agar aap log bhi ghar ka achaar ya papad banaate ho toh main bataati hoon maine kya kiya.",
    tags: ["pickle", "homemade", "firstorder", "pune", "achaar"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "home_food_biz_india",
    type: "community",
  },
  {
    authorUsername: "vivek_kapur_chd",
    title: "What caterers don't tell you about wedding season pricing",
    description: "In Chandigarh, November–February wedding season accounts for 70% of our annual revenue. The trap most small caterers fall into: they quote low to get bookings in July and then get stuck when raw material costs jump in winter. We now add a 12% fuel+inflation buffer to all bookings made more than 90 days out. Has saved us from losses twice already.",
    tags: ["catering", "wedding", "pricing", "chandigarh", "business"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    type: "normal",
  },
  {
    authorUsername: "expert_meera_krishnan",
    title: "The real cost of a 500-plate wedding catering order — a breakdown",
    description: "After 25 years of catering, I want to share what most new caterers undercount:\n\n• Raw material: ₹110–130/plate\n• Staff (12 people): ₹18,000 for the day\n• Gas + fuel: ₹4,000\n• Disposables and decor: ₹8,000\n• Transport: ₹3,500\n• Buffer for wastage: 8%\n\nAt these numbers, ₹180/plate is breakeven, not profit. Quote below ₹220 and you're working for free. Please check your numbers before taking the next order.",
    tags: ["catering", "costing", "weddingfood", "fnb", "margins"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "hyd_food_catering",
    type: "community",
  },
  {
    authorUsername: "expert_lalitha_prabhakar",
    title: "FSSAI basic vs state licence — which one does your food business actually need?",
    description: "I get this question every day so here is the clearest version I can write:\n\n📌 Basic Registration (₹100/yr): Annual turnover under ₹12 lakh. Petty food businesses, home-based sellers.\n📌 State Licence (₹2000–5000/yr): Turnover ₹12L–20Cr. Most small restaurants, caterers, cloud kitchens.\n📌 Central Licence: Turnover above ₹20Cr OR operating in 2+ states.\n\nMost people here need State Licence. Apply at foscos.fssai.gov.in. Do NOT pay any agent more than ₹500 for this — it is a straightforward online process.",
    tags: ["fssai", "foodlicence", "compliance", "msme", "foodbusiness"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "home_food_biz_india",
    type: "community",
  },
  {
    authorUsername: "haribhai_solanki_ahm",
    title: "Highway dhaba mein online payment laana — experience share kar raha hoon",
    description: "2 saal pehle mujhe koi nahi bata sakta tha ki QR code kya hota hai. Aaj mere dhabe mein 40% payments UPI se aati hain. Shuru mein truck drivers ke liye mushkil tha — unhe cash chahiye tha. Maine ek mahine mein sirf 10 rupaye cashback diya UPI se — bas itna kafi tha. Ab woh khud kehte hain QR scan karo.",
    tags: ["dhaba", "upi", "digitalpayments", "gujarat", "highway"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    type: "normal",
  },
  {
    authorUsername: "kaveri_krish_blr",
    title: "Farmer market vs. Instagram DMs — which channel actually works for artisan food brands?",
    description: "We sell cold-pressed oils, millet snacks, and artisan jams at Bengaluru's Jayanagar and Indiranagar farmer markets on weekends. Our Instagram has 4,200 followers. Revenue comparison:\n\n• Farmer markets: ₹18,000–24,000/weekend, zero delivery headache\n• Instagram DMs: ₹8,000–12,000/week, significant packing + delivery effort\n\nFor artisan food — farmer markets win on CAC (cost per customer) and brand trust. Instagram wins on reach. Would love to hear others' experience.",
    tags: ["artisanfood", "d2c", "farmersmarket", "bengaluru", "organic"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "home_food_biz_india",
    type: "community",
  },
  {
    authorUsername: "samir_khanna_del",
    title: "Running a fine dining restaurant in 2025 — what's actually changed",
    description: "We've been running Zaffran in GK-II since 2014. What's genuinely changed post-COVID:\n\n1. Average spend per cover is up 35% but footfall is down 20%\n2. Sunday lunches are now more profitable than Friday dinners\n3. Wedding season enquiries have doubled — event catering now 30% of revenue\n4. Zomato cut matters less; our WhatsApp reservation list is 80+ people deep\n\nFine dining is not dying. The audience is just smaller and more intentional now.",
    tags: ["finedining", "restaurant", "delhi", "hospitality", "fnb"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    type: "normal",
  },
  {
    authorUsername: "expert_amina_siddiqui",
    title: "Halal catering certification — do you actually need it or is it just marketing?",
    description: "Short answer: for local family functions and weddings in Muslim communities — nobody asks for a certificate, they trust the caterer's word. For hotels, hospitals, and corporate contracts — yes, written halal certification from a recognized body (like Jamiat Ulama) opens doors and increases your quote by 15–20%. For export or overseas event catering — mandatory. Know your market before spending ₹15,000 on certification.",
    tags: ["halal", "catering", "certification", "hyderabad", "fnb"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "hyd_food_catering",
    type: "community",
  },
  {
    authorUsername: "laxmi_reddy_hyd",
    title: "Meri tiffin service mein yeh ek cheez badli — orders 30 se 90 ho gaye",
    description: "Main 3 saal se tiffin de rahi hoon. Orders 30 pe stuck the. Maine sirf ek cheez ki — WhatsApp status pe roz lunch photo daalna shuru kiya. Sirf yeh. Koi paid promotion nahi. Teen mahine mein 90 orders. Log khud forward karne lagte hain photos. Ghar wala khana dikhna chahiye — simple, saaf, aur seedha.",
    tags: ["tiffin", "whatsapp", "marketing", "hyderabad", "homefood"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "home_food_biz_india",
    type: "community",
  },
  {
    authorUsername: "siddharth_jain_ind",
    title: "Expanding café to Bhopal — does it make sense to own or franchise?",
    description: "We have 3 The Flour & Grain outlets in Indore running well. We get enquiries from Bhopal people every month. Question is — do we open company-owned (higher control, higher capex ₹35–40L) or explore a franchise model (lower risk, harder to control quality)? Has anyone here scaled a café or QSR beyond their home city? What model worked?",
    tags: ["cafe", "franchise", "expansion", "indore", "bhopal"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: true,
    communityUsername: "upscale_restaurants_india",
    type: "community",
  },
  {
    authorUsername: "expert_savita_kulkarni",
    title: "Ghar ki kitchen se commercial catering tak — 7 cheezein jo main dusri baar nahi karungi",
    description: "1. Pehle din se FSSAI le lo — baad mein penalty se sasta hai\n2. Gas commercial cylinder liye bina volume mat badhaao\n3. Staff hire mat karo — pehle family se shuru karo, phir expand karo\n4. Advance lete waqt kuch nahi — advance lena MANDATORY hai\n5. Plates ka hisaab roz rakhna — wastage wahan se aata hai\n6. Ek bura event sab kuch le sakta hai — reputation insurance hai consistency\n7. Apni recipe kisi ko mat batao — yahi aapki moat hai\n\nKoi aur hai jo yeh journey kar raha hai?",
    tags: ["homecatering", "catering", "lessons", "women", "fnb"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "home_food_biz_india",
    type: "community",
  },

  // ══ TEXTILES & HANDICRAFTS ══════════════════════════════════════════════

  {
    authorUsername: "sukhdev_tiwari_vns",
    title: "Banarasi silk weavers ke liye koi sahi online marketplace hai kya?",
    description: "Main seedha sell karna chahta hoon — koi middleman nahi. Mera GI tag hai, quality pakki hai. Amazon Karigar try kiya tha, orders thode hain. Kisi ne GoCoop ya IndiaCraft try kiya hai? Ya seedha Instagram se kaam chalata hai?",
    tags: ["banarasi", "silk", "handloom", "onlineselling", "varanasi"],
    interest: [{ interestType: "businessCategory", value: ["Handicrafts & Artisans"] }],
    isQuery: true,
    communityUsername: "varanasi_weavers",
    type: "community",
  },
  {
    authorUsername: "expert_jagdish_tiwari",
    title: "How I started selling Banarasi sarees directly to US boutiques — no middleman",
    description: "In 2009 I got my first international order through a Californian woman who visited my workshop as a tourist. I gave her 3 sarees to show her boutique. Six months later she placed an order for 40 pieces. The things that made it work:\n\n• Consistent packaging (bought proper saree boxes)\n• PayPal account — took time but worked\n• Photos in natural light — no fake studio shots\n• Every saree tagged with weaver name and silk mark certificate\n\nToday 60% of our revenue is direct international. It took 4 years to build.",
    tags: ["handloomexport", "banarasi", "international", "directsales", "varanasi"],
    interest: [{ interestType: "businessCategory", value: ["Textiles & Apparel"] }],
    isQuery: false,
    communityUsername: "varanasi_weavers",
    type: "community",
  },
  {
    authorUsername: "gurpreet_sandhu_ldh",
    title: "Polyester mein switch karna padega kya? Wool cost 40% badh gayi",
    description: "Ludhiana mein sab ek hi sawaal pooch rahe hain. Merino wool ki cost pichhle 18 mahine mein 40% badh gayi. Kuch units polyester blend switch kar rahe hain. Mujhe nahi karna — mera brand pure wool pe bana hai. Koi solution hai? Koi group purchasing association hai region mein?",
    tags: ["hosiery", "wool", "rawmaterial", "ludhiana", "cost"],
    interest: [{ interestType: "businessCategory", value: ["Textiles & Apparel"] }],
    isQuery: true,
    communityUsername: "ldh_hosiery_mfr",
    type: "community",
  },
  {
    authorUsername: "anwarali_momin_srt",
    title: "Surat se seedha buyer kaise dhundhe? Wholesalers bahut margin le rahe hain",
    description: "Main saree aur dress material ka wholesale karta hoon. Mera maal acha hai lekin distributors 28–35% margin le jaate hain. Koi directly Delhi ya Mumbai ke boutique owners se connect karne ka tarika bata sakta hai? Ya koi B2B platform jahan main apna catalog daal sakta hoon?",
    tags: ["surat", "saree", "wholesale", "buyers", "textiles"],
    interest: [{ interestType: "businessCategory", value: ["Textiles & Apparel"] }],
    isQuery: true,
    communityUsername: "surat_textile_traders",
    type: "community",
  },
  {
    authorUsername: "expert_rukhsana_begum",
    title: "Chikankari karigars ko sahi daam kaise dilayein — meri 25 saal ki seekh",
    description: "Jab main shuru ki thi, main bhi kam deti thi karigars ko. Galat tha. Yeh seekha:\n\n• Karigar ka cost calculate karo: ek saree mein 8–12 ghante ka kaam = ₹800–1200 sirf labour\n• Material + overhead + margin add karo — ₹2500 se kam pe sell karna naam kharab karta hai\n• Jo buyer ₹600 mein chikankari maange, woh buyer nahi hai\n• Karigar ki income badhi toh quality badhi — seedha connection hai\n\nAapke karigars aapka brand hain.",
    tags: ["chikankari", "artisans", "pricing", "lucknow", "craft"],
    interest: [{ interestType: "businessCategory", value: ["Handicrafts & Artisans"] }],
    isQuery: false,
    communityUsername: "varanasi_weavers",
    type: "community",
  },

  // ══ AGRICULTURE & FOOD PROCESSING ════════════════════════════════════════

  {
    authorUsername: "shankar_patil_pun",
    title: "Mandi vs direct hotel supply — kisi ne try kiya hai?",
    description: "Main tomato aur capsicum ugaata hoon near Pune. Abhi APMC mandi mein bechta hoon — rate theek hain lekin middleman le jaata hai. Ek hotel chain ne direct contract offer kiya hai — fixed rate per kg, weekly collection. Kya yeh reliable hota hai? Koi farmer hai jisne direct hotel/restaurant supply ki hai?",
    tags: ["farmer", "directsupply", "pune", "vegetables", "apmc"],
    interest: [{ interestType: "businessCategory", value: ["Agriculture & Farming"] }],
    isQuery: true,
    communityUsername: "indore_mandi_traders",
    type: "community",
  },
  {
    authorUsername: "expert_mahavir_gupta",
    title: "Mandi mein naye traders ke liye 5 mistakes jo sab karte hain",
    description: "50 saal Indore mandi mein. Yeh galtiyan roz dekhta hoon:\n\n1. Commission agent (arhatiya) se seedha panga — galat. Pehle relationship banao.\n2. Maal udhaar mein dena bina limit ke — ek se zyada nahi dena kabhi.\n3. Rate sunke maal bech do — quality check pehle, rate baad mein.\n4. Sirf ek crop mein investment — diversify karo.\n5. Digital record nahi — aaj bhi haath se likh rahe ho toh problem hogi.\n\nKoi bhi sawaal ho — poochho.",
    tags: ["mandi", "grain", "trading", "indore", "mistakes"],
    interest: [{ interestType: "businessCategory", value: ["Agriculture & Farming"] }],
    isQuery: false,
    communityUsername: "indore_mandi_traders",
    type: "community",
  },
  {
    authorUsername: "pushpa_nair_kochi",
    title: "Kerala spice export — EU residue limits are getting stricter. Prepare now.",
    description: "If you export pepper or cardamom to EU, this is urgent. New MRL (Maximum Residue Limit) regulations effective from March 2025 reduce allowable pesticide traces by 40%. Three of my trading contacts had consignments rejected last month. Steps to take now: switch to registered pesticide suppliers only, maintain crop diary, and test every batch at a NABL lab before shipping. Cost: ~₹3,500 per test. Worth every rupee.",
    tags: ["spiceexport", "EU", "pesticide", "kerala", "compliance"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: false,
    communityUsername: "kerala_spice_traders",
    type: "community",
  },

  // ══ REAL ESTATE & CONSTRUCTION ════════════════════════════════════════════

  {
    authorUsername: "balkrishna_patil_nag",
    title: "Labour contractor vs. direct hiring — kya sahi hai chhote builder ke liye?",
    description: "Main Nagpur mein 3–4 bungalow saath mein karta hoon. Abhi labour contractor se kaam karta hoon — woh apni team laata hai. Lekin unka commission 18% hai. Agar main seedha hire karun toh PF, ESI ka chakkar aata hai. Kisi ne dono try kiya hai? Kya direct hiring actually sasta padta hai chhote level pe?",
    tags: ["construction", "labour", "contractor", "nagpur", "compliance"],
    interest: [{ interestType: "businessCategory", value: ["Real Estate & Construction"] }],
    isQuery: true,
    communityUsername: "small_contractors_india",
    type: "community",
  },
  {
    authorUsername: "expert_ravindra_kadam",
    title: "Udyam registration — karo abhi. Nahi kiya toh yeh fayde miss kar rahe ho",
    description: "Abhi bhi bahut log Udyam registration nahi karate. Yeh free hai aur online hai. Isse milta hai:\n\n• Collateral-free loan up to ₹10L (CGTMSE)\n• Government tender mein preference\n• Electricity bill mein subsidy (state-specific)\n• Delayed payment pe 45-day rule — buyer pe legal protection\n• Priority sector lending rate\n\nudyamregistration.gov.in pe 10 minute mein ho jaata hai. Aadhaar chahiye bas.",
    tags: ["udyam", "msme", "registration", "government", "schemes"],
    interest: [{ interestType: "businessCategory", value: ["Consulting & Professional Services"] }],
    isQuery: false,
    type: "normal",
  },

  // ══ LOGISTICS & TRANSPORT ══════════════════════════════════════════════

  {
    authorUsername: "ravi_shankar_nag",
    title: "Ek truck se fleet tak — kya sochun pehle?",
    description: "Main 15 saal se truck chala raha hoon. Ab apna truck khareedna chahta hoon aur slowly 3–4 tak badhana chahta hoon. Log kehte hain fleet chalana chalaana se alag hota hai. Kya kya dekhna chahiye? Finance kaise milta hai? Freight contracts kaise milte hain? Akele chalate hue kabhi nahi sochna pada tha yeh sab.",
    tags: ["trucking", "fleet", "transport", "logistics", "firsttime"],
    interest: [{ interestType: "businessCategory", value: ["Logistics & Supply Chain"] }],
    isQuery: true,
    type: "normal",
  },
  {
    authorUsername: "expert_bahadur_rawat",
    title: "Ek truck se fleet tak — main yeh kar chuka hoon. Yeh sunna zaroori hai.",
    description: "1990 mein Maine ek Tata 407 se shuru kiya tha. 2015 mein 40 trucks tha fleet. Yeh 5 cheezein yaad rakhna:\n\n1. Pehla truck EMI-free ho jaaye tab dusra lo\n2. Driver agar accha hai toh partner jaise rakho — unki loyalty sabse bada asset hai\n3. Freight broker pe depend mat raho — direct shippers dhundho\n4. FASTag data dekho — apna diesel cost per km track karo\n5. Ek bura raasta ek truck barbaad kar sakta hai — GPS tracking se bhi zyada route discipline chahiye\n\nKoi bhi sawaal poochho — main yahan hoon.",
    tags: ["trucking", "fleet", "transport", "experience", "advice"],
    interest: [{ interestType: "businessCategory", value: ["Logistics & Supply Chain"] }],
    isQuery: false,
    type: "normal",
  },

  // ══ UPSCALE / PREMIUM BUSINESSES ════════════════════════════════════════

  {
    authorUsername: "nandini_rao_blr",
    title: "Boutique property on OTA vs. direct — the numbers after 3 years",
    description: "The Nilgiri House — 12 rooms, heritage property, Coorg. Here is the honest breakdown after 3 years:\n\n• OTA (Booking.com / MMT): 60% of bookings but 22–25% commission\n• Instagram + direct website: 35% bookings, zero commission, higher average spend\n• Google My Business: 5% — surprisingly consistent\n\nThe shift happened when we stopped depending on OTA for discovery and started using them only as a last-resort fill channel. Direct bookings now have 42% higher revenue per stay.",
    tags: ["boutiquehotel", "ota", "hospitality", "coorg", "directbooking"],
    interest: [{ interestType: "businessCategory", value: ["Hospitality"] }],
    isQuery: false,
    communityUsername: "boutique_hotels_homestays",
    type: "community",
  },
  {
    authorUsername: "arjun_oberoi_del",
    title: "Pre-owned luxury car business — questions I wish someone had answered before I started",
    description: "Running a pre-owned luxury segment (BMW/Merc/Audi) business in South Delhi for 8 years. Things that aren't obvious:\n\n• Financing is the actual product — 70% of my buyers don't pay cash\n• Inspection and certification costs ₹8,000–15,000 per car but is non-negotiable for trust\n• The hardest part is sourcing good inventory, not selling\n• One bad car (hidden accident) will destroy 10 good reviews\n\nAnyone else in this segment?",
    tags: ["usedcars", "luxury", "automobiles", "delhi", "autobusiness"],
    interest: [{ interestType: "businessCategory", value: ["Automobiles"] }],
    isQuery: false,
    type: "normal",
  },
  {
    authorUsername: "rajiv_mehra_mum",
    title: "Interior design clients who don't pay — how do you handle it?",
    description: "We do high-end residential work in Bandra and Juhu. Project sizes ₹25L–80L. Despite signed contracts, we've had 3 cases in 8 years where clients delayed final payment by 6–12 months after site handover. Went legal once — took 2 years. Has anyone found a practical solution? Milestone-based payments helped but clients find ways to 'dispute' the milestone.",
    tags: ["interiordesign", "clientpayment", "businessproblems", "mumbai", "legal"],
    interest: [{ interestType: "businessCategory", value: ["Furniture & Home Decor"] }],
    isQuery: true,
    type: "normal",
  },

  // ══ ASPIRING / EXPLORING ══════════════════════════════════════════════════

  {
    authorUsername: "aakash_sharma_del",
    title: "Sarkari naukri ke saath chai ki tapri — pagalpan hai ya ho sakta hai?",
    description: "Main PWD mein kaam karta hoon. Office ke baad time hai. Paas mein ek corner spot available hai — maalik ne ₹4,000/month mein dene ko kaha hai. Bas chai, maggi, toast. Seedha sawaal: kya yeh dono saath chalega? Koi hai jo yeh kar raha ho ya kar chuka ho?",
    tags: ["chai", "sideproject", "secondincome", "delhi", "streetfood"],
    interest: [{ interestType: "businessCategory", value: ["Food & Beverages"] }],
    isQuery: true,
    communityUsername: "start_biz_india",
    type: "community",
  },
  {
    authorUsername: "sunita_devi_pat",
    title: "Ghar mein Madhubani art banati hoon — koi kharidega online?",
    description: "Main Darbhanga se hoon, ab Varanasi mein rehti hoon. Shaadi ke baad se sirf ghar ke kaam mein lagi hoon. Lekin Madhubani painting meri maa ne sikhaayi hai — log dekhte hain toh kehte hain bikenge. Maine kabhi nahi beche. Kya Etsy type platform India mein bhi kaam karta hai? Ya koi aur jagah hai?",
    tags: ["madhubani", "art", "homemade", "handmade", "selling"],
    interest: [{ interestType: "businessCategory", value: ["Handicrafts & Artisans"] }],
    isQuery: true,
    communityUsername: "start_biz_india",
    type: "community",
  },
  {
    authorUsername: "pradeep_garg_mrr",
    title: "2 acre zameen aur retirement ke baad kya karun — organic farm ya poultry?",
    description: "Army se retire ho gaya hoon. Zameen hai Meerut ke paas — baap ne di thi. Khet mein kuch karna chahta hoon. Dono option soch raha hoon:\n\n• Organic vegetables: slow income, better for long term\n• Poultry (broiler): faster return but disease risk\n\nMujhe 5 saal ka plan chahiye jisme ₹30–40k monthly aayen. Koi farmer hai jo guide kar sake?",
    tags: ["farming", "retirement", "meerut", "organic", "poultry"],
    interest: [{ interestType: "businessCategory", value: ["Agriculture & Farming"] }],
    isQuery: true,
    communityUsername: "start_biz_india",
    type: "community",
  },
  {
    authorUsername: "varsha_tomar_gur",
    title: "Home playschool — licence kya chahiye Haryana mein?",
    description: "Main Gurgaon mein apne ghar se playschool shuru karna chahti hoon — 3–5 saal ke bacchon ke liye. 15 bacche max. Mujhe nahi pata ki kya permission chahiye. Kisi jaannay wale ne kaha NCPCR se registration lena padta hai, kisi ne kaha sirf municipal NOC chahiye. Koi clear bata sakta hai?",
    tags: ["playschool", "preschool", "gurgaon", "education", "licence"],
    interest: [{ interestType: "businessCategory", value: ["Education & EdTech"] }],
    isQuery: true,
    communityUsername: "start_biz_india",
    type: "community",
  },

  // ══ SPAM / ADS (very few, realistic looking) ══════════════════════════════

  {
    authorUsername: "rameshbhai_patel_srt",
    title: "🔥 BEST PRICE GUARANTEED — Industrial Racks & Storage for Kirana/Warehouse",
    description: "Full steel heavy duty racks FOR YOUR SHOP / WAREHOUSE\n✅ All sizes available\n✅ Installation free in Surat, Ahmedabad, Baroda\n✅ 1 year warranty\n📞 Call/WhatsApp: 9876XXXXXX\nDM for catalogue. Bulk orders available. Export quality. Limited stock!!",
    tags: ["racks", "storage", "warehouse", "surat", "offer"],
    interest: [{ interestType: "businessCategory", value: ["E-Commerce & Retail"] }],
    isQuery: false,
    type: "normal",
    isSpam: true,
  },
  {
    authorUsername: "suresh_agarwal_ind",
    title: "Grow Your Business 10X With Our Digital Marketing Package — Only ₹999/month!",
    description: "Are you a small business owner? Do you want more customers? Our proven system will get you 500 leads per month GUARANTEED!\n\n✅ Google Ads\n✅ Facebook Ads\n✅ SEO\n✅ WhatsApp bulk marketing\n\nFirst month FREE! Limited slots. Message now. Don't miss this chance. 100% money back guarantee. Call now: 98XXXXXXXX",
    tags: ["digitalmarketing", "leads", "smallbusiness", "offer"],
    interest: [{ interestType: "businessCategory", value: ["Marketing & Advertising"] }],
    isQuery: false,
    type: "normal",
    isSpam: true,
  },
];

// ─── Comments keyed by post title snippet → array of {authorUsername, content} ─
const COMMENT_DEFS = {
  "30 saal mein jo seekha": [
    { author: "md_aslam_lko", content: "Point 4 — staff ko pehle khilao — yeh sabse important hai. Mere purane chef ne 15 saal kaam kiya sirf isliye ki woh jaanta tha unka khyaal rakha jaata hai." },
    { author: "laxmi_reddy_hyd", content: "WhatsApp group marketing bilkul sahi kaha! Mere area mein building ki ladies group se hi 60% orders aate hain. Zero paisa lagta hai." },
    { author: "savitri_yadav_kan", content: "Rice quality — yeh point bahut log ignore karte hain. Hum bhi pehle saste chawal use karte the. Jab se basmati switch ki tab se repeat customers badh gaye." },
    { author: "expert_meera_krishnan", content: "Point 3 is hardest for new entrants to believe. Everyone wants profit from day 1. The first 3 years are about building repeat customers, not margins." },
    { author: "haribhai_solanki_ahm", content: "Aap se agree karta hoon bhai. 1998 mein maine bhi yahi sab seekha tha. Naam sabse bada hai." },
  ],
  "Meri tiffin service mein yeh ek cheez badli": [
    { author: "chandrabai_jadhav", content: "WhatsApp status! Yahi main bhi kar rahi hoon ab. Tumhara example sunke confidence aaya." },
    { author: "fatima_shaikh_mum", content: "Matlab sirf photo daalo roz? Koi caption likhna zaroori hai?" },
    { author: "laxmi_reddy_hyd", content: "Caption simple rakho — jo bana hai aaj, thoda kuch personal baat. Log connect karte hain ghar ke khane se emotionally." },
    { author: "expert_savita_kulkarni", content: "It works because it builds trust. People see you cook every day — they feel they know you. That is worth more than any advertisement." },
  ],
  "FSSAI basic vs state licence": [
    { author: "fatima_shaikh_mum", content: "Bohot helpful! Toh mera turnover abhi ₹0 hai — basic registration se start kar sakti hoon?" },
    { author: "expert_lalitha_prabhakar", content: "Haan, bilkul. Jab aap ₹12 lakh cross karo tab state licence upgrade karo. Shuru basic registration se hi karo — ₹100 mein. Foscos.fssai.gov.in." },
    { author: "manish_dubey_vns", content: "Agent ne mujhse ₹3500 maange the state licence ke liye. Seedha apply kar diya — ₹2000 mein ho gaya. Thank you for this post." },
    { author: "chandrabai_jadhav", content: "Maine bhi agent se karwaya tha pehle. Kitna paisa waste kiya. Kash yeh pehle padha hota." },
    { author: "kaveri_krish_blr", content: "Bookmarking this. Shared this in our farmer market WhatsApp group — half of the sellers there don't have FSSAI." },
  ],
  "Behen log — ghar se biryani delivery": [
    { author: "expert_lalitha_prabhakar", content: "Basic registration lelo pehle. ₹100 mein aur 1 din mein hota hai. Zyada mat socho pehla step." },
    { author: "laxmi_reddy_hyd", content: "Main bhi aise hi shuru ki thi. Pehle 10 orders friends ke the. Tab confidence aaya. Mat ruko." },
    { author: "expert_savita_kulkarni", content: "Malad mein bahut demand hai ghar ke khane ki. Start karo — perfect hone ka intezaar mat karo." },
    { author: "savitri_yadav_kan", content: "Ek baar shuru karo. Pehla order sabse mushkil hota hai. Baaki automatically seekhti rahogi." },
  ],
  "Farmer market vs. Instagram DMs": [
    { author: "kaveri_krish_blr", content: "Adding: farmer market customers also become your brand ambassadors organically. Three of my top DM customers found me through someone they met at the Jayanagar market." },
    { author: "chandrabai_jadhav", content: "Hamare yahan Pune mein bhi haats hain. Main yahi try karungi. Online delivery ki headache bahut hai." },
    { author: "siddharth_jain_ind", content: "For artisan food this makes total sense. Our bakery did pop-ups before we opened permanent outlets — it validated demand without full capex risk." },
    { author: "expert_meera_krishnan", content: "The CAC comparison is the right lens. Most home food businesses underestimate delivery cost when comparing channels." },
  ],
  "Banarasi silk weavers ke liye": [
    { author: "expert_jagdish_tiwari", content: "Amazon Karigar main use karta hoon — orders aate hain lekin margin thin hai. Apna Instagram + WhatsApp channel actually better RoI deta hai mujhe." },
    { author: "expert_rukhsana_begum", content: "GoCoop se connected hoon — cooperative model mein margin better hai. Try karo, registration mein thoda time lagta hai." },
    { author: "sukhdev_tiwari_vns", content: "Jagdish bhai — Instagram pe kaise shuru kiya? Photos professional hai ya phone se?" },
    { author: "expert_jagdish_tiwari", content: "Sirf phone se — natural light mein. White bedsheet background. Consistency zyada important hai professional photos se." },
  ],
  "Polyester mein switch karna padega kya": [
    { author: "expert_bhupinder_khurana", content: "Group purchasing try kiya tha 2017 mein. 8 units saath mein mill se seedha kharida — 12% discount mila. Abhi bhi wohi group chal raha hai. Formal nahi hai, bas WhatsApp group hai." },
    { author: "gurpreet_sandhu_ldh", content: "Khurana ji — please add karo mujhe bhi is group mein. DM karta hoon aapko." },
    { author: "expert_harbhajan_arora", content: "Association ke through bulk procurement ho sakta hai. Ludhiana Hosiery Manufacturers Association ke pass yeh proposal hai — abhi implement nahi hua. Pressure dalna chahiye." },
  ],
  "Ek truck se fleet tak — kya sochun": [
    { author: "expert_bahadur_rawat", content: "Pehli baat — kya aapka pehla truck cash hai ya loan pe? Yeh answer bahut kuch decide karta hai." },
    { author: "ravi_shankar_nag", content: "Loan pe hai — 8 mahine baki hain EMI ke. Tab kya karun?" },
    { author: "expert_bahadur_rawat", content: "EMI khatam hone do pehle. 8 mahine mein save karo. Tab dusra khareedna zyada achha hoga — cash down doge toh interest bachega." },
    { author: "suresh_kumar_nair", content: "Mujhe bhi yahi plan hai. Auto se taxi aggregator tak. Aapka experience sunna tha." },
  ],
  "Ek truck se fleet tak — main yeh kar chuka": [
    { author: "ravi_shankar_nag", content: "Point 2 — driver retention. Yeh meri bhi sabse badi chinta hai. Acche drivers kahan se milte hain aur kaise rokein?" },
    { author: "expert_bahadur_rawat", content: "Accha driver ko 10% se upar dena padta hai market se. Aur ek chota sa bonus Diwali mein. Chhota lagta hai lekin loyalty banata hai." },
    { author: "tarun_mishra_lko", content: "Yeh thread bookmark kar liya. Kuch nahi pata tha transport business ke baare mein. Bahut kuch seekha." },
  ],
  "Udyam registration — karo abhi": [
    { author: "balkrishna_patil_nag", content: "Maine kar liya 2021 mein. Bank loan interest rate mein 1.5% discount mila. Bilkul free tha." },
    { author: "manish_dubey_vns", content: "Kya proprietorship pe bhi hota hai ya sirf company ke liye hai?" },
    { author: "expert_ravindra_kadam", content: "Proprietorship pe bhi hota hai — actually majority Udyam registrations proprietorships ki hi hain. Aadhaar se seedha link hota hai." },
    { author: "santosh_gujar_pun", content: "Main kal hi karunga. Nahi pata tha itna asaan hai." },
    { author: "geeta_rawat_del", content: "Mera beta kar dega mujhe. Mujhe nahi aata online. Thank you." },
  ],
  "Boutique property on OTA vs. direct": [
    { author: "meenakshi_pillai_kochi", content: "This matches our experience at the homestay exactly. We reduced our Booking.com dependency from 75% to 40% in 2 years. Google My Business is underrated — we get 3–4 serious enquiries a month from there." },
    { author: "vivek_kapur_chd", content: "For events and corporate stays — direct relationship is even more important. No OTA can match the customisation you offer." },
    { author: "expert_amina_siddiqui", content: "Similar dynamic in catering — platform aggregators take 18–25%. Direct repeat clients are the backbone. Build that base." },
  ],
  "Home playschool — licence kya chahiye": [
    { author: "varsha_tomar_gur", content: "Koi bata sakta hai please? Bahut confusing information hai online." },
    { author: "expert_bhagwati_devi", content: "Haryana mein home-based playschool ke liye: municipal NOC (fire + building), RTE compliance if you take govt funding, and local police verification. NCPCR direct registration home-based scale pe mandatory nahi hai. But get a proper deed done." },
    { author: "varsha_tomar_gur", content: "Bhagwati ji bahut bahut shukriya! Itna clear kisi ne nahi bataya tha." },
  ],
  "Interior design clients who don't pay": [
    { author: "anita_singhania_kol", content: "We face this in jewellery too — custom orders especially. 50% advance is non-negotiable now. No exceptions." },
    { author: "rajiv_mehra_mum", content: "Yes we do 40% advance, 40% on site start, 20% on completion. The problem is the final 20% — clients suddenly find 'issues' at handover." },
    { author: "expert_satish_agarwal", content: "Final 10% can always become a dispute — some established contractors just price it in as a cost of business and consider the job complete at 90%. Painful but realistic." },
    { author: "arjun_oberoi_del", content: "Video documentation at every milestone — sounds extreme but has saved us twice. Client can't dispute what's on record." },
  ],
  "Ghar ki kitchen se commercial catering tak": [
    { author: "fatima_shaikh_mum", content: "Point 4 — advance lena — yeh sunke darr laga. Kya log dete hain advance? Koi mana nahi karta?" },
    { author: "expert_savita_kulkarni", content: "Pehle darne lagti thi main bhi. Ab seedha bolta hoon — 50% advance bina booking confirm nahi. Jo serious hai woh deta hai. Jo nahi deta, woh problem bhi nahi deta." },
    { author: "laxmi_reddy_hyd", content: "Yeh 7 points save kar liye. Mera tiffin business 2 saal ho gaya — abhi bhi seekh rahi hoon." },
    { author: "chandrabai_jadhav", content: "Recipe kisi ko mat batao — yeh line bahut sahi likhi. Meri masala recipe ek neighbor ne copy karli thi." },
  ],
  "Running a fine dining restaurant in 2025": [
    { author: "siddharth_jain_ind", content: "Point 4 — WhatsApp reservation list. We started this at our Indore café and it transformed how we manage weekends. Direct relationship > any platform." },
    { author: "kaveri_krish_blr", content: "Sunday lunch being more profitable than Friday dinner is interesting. Do you think it's because Sunday families spend more on desserts/drinks?" },
    { author: "samir_khanna_del", content: "Exactly that. Sunday lunch has 60% higher dessert and mocktail order rate than Friday dinner. Families come hungry and relaxed." },
    { author: "expert_amina_siddiqui", content: "The wedding/event revenue shift is happening across all premium F&B. Smart operators are building that capacity intentionally." },
  ],
  "Sarkari naukri ke saath chai ki tapri": [
    { author: "expert_mahavir_gupta", content: "Practicable hai agar location sahi ho. Chai stall subah ke liye hai — 7am-10am. Shaam ko bhi chal sakta hai. PWD job ke baad waqt bahut hai. Start karo." },
    { author: "manish_dubey_vns", content: "Mere padosi ne yahi kiya — clerk hai municipal mein. Chai stall chalata hai wife ke saath. Dono mil ke ₹35-40k mahina kama lete hain usse." },
    { author: "aakash_sharma_del", content: "Yeh sunke bohot himmat aayi. Kitne investment se shuru kar sakte hain rough idea batao?" },
    { author: "md_aslam_lko", content: "₹15,000–20,000 mein basic setup ho jaata hai. Stall + equipment. Pehle mahine break-even nahi hoga — 2-3 mahine dena padega." },
  ],
  "2 acre zameen aur retirement ke baad": [
    { author: "shankar_patil_pun", content: "Organic vegetables — slow start hai lekin 3-4 saal mein stable income hai. Poultry mein disease risk bohot zyada hai pehli baar ke liye. Main suggest karunga vegetables seedha restaurant supply try karo." },
    { author: "expert_jayaram_hegde", content: "If the land is near Meerut — maize and mustard are underrated options before going full organic. Lower input, steady market. Transition to organic takes 3 years officially." },
    { author: "pradeep_garg_mrr", content: "Jayaram sir — mustard seedha mandi mein bikta hai ya koi processor dhundhna padta hai?" },
    { author: "expert_jayaram_hegde", content: "Directly to mandi in your case at starting scale. Once you hit 10-15 quintals per season, processor options open up." },
  ],
  "Ghar mein Madhubani art banati hoon": [
    { author: "expert_zubeda_khatoon", content: "Etsy India mein bilkul kaam karta hai — meri karigars bhi use karti hain. Lekin setup time lagta hai. Pehle Instagram banao, free hai, faster result milega. 10 achhi photos — natural light, white background. Start today." },
    { author: "savita_mishra_bho", content: "Main bhi Madhubani aur handmade paper sell karti hoon. Instagram se shuru kiya tha. 8 mahine mein pehli baar Delhi se order aaya. Himmat rakho." },
    { author: "sunita_devi_pat", content: "Dono ne itna encourage kiya! Kal Instagram banaungi. Thank you." },
    { author: "expert_rukhsana_begum", content: "Authenticity hi aapki strength hai. Jo cheez Darbhanga ki mitti se aati hai woh koi factory match nahi kar sakti. Usse showcase karo." },
  ],
};

// ─── Replies for some comment threads ────────────────────────────────────────
const REPLY_DEFS = {
  "EMI khatam hone do pehle. 8 mahine": [
    { author: "ravi_shankar_nag", content: "Samajh gaya. Toh 8 mahine mein maximum save karna chahiye — ek ek rupaya." },
  ],
  "For jewellery custom orders it makes": [
    { author: "rajiv_mehra_mum", content: "Our problem is the final 20% — clients want 'just one more change' at handover. Documenting everything now." },
  ],
  "Haan, bilkul. Jab aap ₹12 lakh": [
    { author: "manish_dubey_vns", content: "Bilkul samajh aaya. Abhi basic se shuru karte hain. Thank you." },
  ],
  "Sirf phone se — natural light mein": [
    { author: "anwarali_momin_srt", content: "Phone se photos — yeh main bhi try kar sakta hoon. Aaj try karta hoon." },
  ],
};

// ─── Community membership plan ────────────────────────────────────────────────
// communityUsername → { adminUsername, memberUsernames[] }
const MEMBERSHIP_PLAN = {
  "hyd_food_catering":        { admin: "md_aslam_lko",           members: ["laxmi_reddy_hyd", "savitri_yadav_kan", "ranjit_dhillon_amt", "haribhai_solanki_ahm", "expert_meera_krishnan", "expert_lalitha_prabhakar", "expert_amina_siddiqui", "kaveri_krish_blr", "samir_khanna_del", "vivek_kapur_chd", "siddharth_jain_ind", "chandrabai_jadhav"] },
  "home_food_biz_india":      { admin: "laxmi_reddy_hyd",        members: ["fatima_shaikh_mum", "chandrabai_jadhav", "expert_savita_kulkarni", "expert_lalitha_prabhakar", "kaveri_krish_blr", "lakshmi_priya_chn", "hemlata_chouhan_ind", "manish_dubey_vns", "savitri_yadav_kan"] },
  "varanasi_weavers":         { admin: "sukhdev_tiwari_vns",     members: ["expert_jagdish_tiwari", "expert_rukhsana_begum", "expert_ramakant_shukla", "anwarali_momin_srt", "savita_mishra_bho", "sunita_devi_pat", "expert_pushpa_tripathi"] },
  "surat_textile_traders":    { admin: "anwarali_momin_srt",     members: ["kokilaben_desai_srt", "expert_hasmukh_mehta", "gurpreet_sandhu_ldh", "dharmaraj_murugan_tpr", "expert_bhupinder_khurana", "expert_usha_venkat"] },
  "ldh_hosiery_mfr":          { admin: "gurpreet_sandhu_ldh",    members: ["expert_bhupinder_khurana", "expert_harbhajan_arora", "naresh_verma_kan", "paramjit_kaur_ldh"] },
  "indore_mandi_traders":     { admin: "champalal_jain_ind",     members: ["expert_mahavir_gupta", "suresh_agarwal_ind", "shankar_patil_pun", "expert_rameshwar_nat", "pushpa_nair_kochi"] },
  "kerala_spice_traders":     { admin: "pushpa_nair_kochi",      members: ["expert_meenakumari_nair", "expert_radhakrishnan", "meenakshi_pillai_kochi", "kavitha_nair_kochi", "expert_jayaram_hegde"] },
  "start_biz_india":          { admin: "expert_savitaben_patel", members: ["aakash_sharma_del", "sunita_devi_pat", "suraj_yadav_lko", "varsha_tomar_gur", "manish_dubey_vns", "hemlata_chouhan_ind", "pradeep_garg_mrr", "lakshmi_priya_chn", "geeta_rawat_del", "pooja_verma_jpr", "mamta_singh_del", "deepak_shetty_mum", "rajiv_nambiar_blr", "asha_kumari_pat", "suresh_kumar_nair", "tarun_mishra_lko"] },
  "msme_loans_schemes":       { admin: "expert_savitaben_patel", members: ["expert_ravindra_kadam", "balkrishna_patil_nag", "santosh_gujar_pun", "manish_dubey_vns", "suresh_agarwal_ind", "ravi_shankar_nag", "naresh_verma_kan", "expert_nandkishore"] },
  "small_contractors_india":  { admin: "balkrishna_patil_nag",   members: ["santosh_gujar_pun", "expert_ravindra_kadam", "dinesh_rajput_lko", "kamalakar_nayak_bhu", "brijmohan_lal_mrr"] },
  "boutique_hotels_homestays":{ admin: "nandini_rao_blr",        members: ["meenakshi_pillai_kochi", "vivek_kapur_chd", "expert_vivek_sharma", "rajan_sharma_jai"] },
  "upscale_restaurants_india":{ admin: "samir_khanna_del",       members: ["siddharth_jain_ind", "kaveri_krish_blr", "vivek_kapur_chd", "arjun_oberoi_del", "expert_amina_siddiqui", "rajiv_mehra_mum"] },
  "kanpur_leather_circle":    { admin: "naresh_verma_kan",       members: ["expert_nandkishore", "expert_ram_swaroop", "dharmaraj_murugan_tpr"] },
  "tirupur_knitwear":         { admin: "dharmaraj_murugan_tpr",  members: ["expert_kamakshi_sub", "expert_bhupinder_khurana", "gurpreet_sandhu_ldh"] },
  "women_led_biz_india":      { admin: "expert_bhagwati_devi",   members: ["chandrabai_jadhav", "fatima_shaikh_mum", "sunita_devi_pat", "savita_mishra_bho", "hemlata_chouhan_ind", "lakshmi_priya_chn", "varsha_tomar_gur", "pooja_verma_jpr", "mamta_singh_del", "geeta_rawat_del", "expert_rukhsana_begum", "expert_savita_kulkarni", "expert_zubeda_khatoon", "anita_singhania_kol", "nandini_rao_blr"] },
  "punjab_agri_dairy":        { admin: "paramjit_kaur_ldh",      members: ["expert_mahavir_gupta", "shankar_patil_pun", "pradeep_garg_mrr", "ramanna_gowda_blr"] },
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(config.mongodburl, { serverSelectionTimeoutMS: 30000 });
  console.log("✅ MongoDB connected");

  if (CLEAR) {
    const allUsers = await User.find({}).select("_id");
    const uids = allUsers.map(u => u._id);
    await Post.deleteMany({ userId: { $in: uids } });
    await Comment.deleteMany({ userId: { $in: uids } });
    await Reply.deleteMany({ userId: { $in: uids } });
    await Like.deleteMany({ userId: { $in: uids } });
    await CommunityMember.deleteMany({});
    console.log("🗑  Cleared all posts, comments, replies, likes, community members");
  }

  // ── Load all users and communities into lookup maps ──────────────────────
  const allUsers = await User.find({}).select("_id username location");
  const userMap = {};
  for (const u of allUsers) userMap[u.username] = u;

  const allCommunities = await Community.find({}).select("_id communityUsername");
  const communityMap = {};
  for (const c of allCommunities) communityMap[c.communityUsername] = c;

  // ── Community members ────────────────────────────────────────────────────
  let memberCount = 0;
  for (const [comUsername, plan] of Object.entries(MEMBERSHIP_PLAN)) {
    const community = communityMap[comUsername];
    if (!community) { console.warn(`  ⚠ Community not found: ${comUsername}`); continue; }

    const adminUser = userMap[plan.admin];
    if (adminUser) {
      try {
        await CommunityMember.create({ communityId: community._id, memberId: adminUser._id, communityRole: "admin", status: "active" });
        memberCount++;
      } catch (e) { if (e.code !== 11000) console.error(`Member err: ${e.message}`); }
    }

    for (const username of plan.members) {
      const u = userMap[username];
      if (!u) continue;
      try {
        await CommunityMember.create({ communityId: community._id, memberId: u._id, communityRole: "member", status: "active" });
        memberCount++;
      } catch (e) { if (e.code !== 11000) console.error(`Member err: ${e.message}`); }
    }
  }
  console.log(`✅ Community members added: ${memberCount}`);

  // ── Posts ────────────────────────────────────────────────────────────────
  const postMap = {}; // titleSnippet → Post doc
  let postCount = 0;

  for (const def of POST_DEFS) {
    const author = userMap[def.authorUsername];
    if (!author) { console.warn(`  ⚠ Author not found: ${def.authorUsername}`); continue; }

    const community = def.communityUsername ? communityMap[def.communityUsername] : null;

    const postDoc = await Post.create({
      userId: author._id,
      title: def.title,
      description: def.description,
      tags: def.tags,
      interest: def.interest,
      postType: def.type,
      communityId: community ? community._id : undefined,
      audienceSelection: "public",
      makePostAsQuery: !!def.isQuery,
      location: author.location || { type: "Point", coordinates: [0, 0] },
      likeCount: 0,
      viewCount: rand(30, 800),
    });

    // store by title snippet for comment matching
    const key = def.title.substring(0, 30);
    postMap[key] = postDoc;
    postCount++;
  }
  console.log(`✅ Posts created: ${postCount}`);

  // ── Comments & Replies ───────────────────────────────────────────────────
  let commentCount = 0;
  let replyCount = 0;
  const commentMap = {}; // content snippet → Comment doc

  for (const [titleSnippet, comments] of Object.entries(COMMENT_DEFS)) {
    // find post by matching title snippet
    const postKey = Object.keys(postMap).find(k => k.includes(titleSnippet.substring(0, 20)) || titleSnippet.substring(0, 20).includes(k.substring(0, 15)));
    const post = postKey ? postMap[postKey] : null;
    if (!post) { console.warn(`  ⚠ Post not found for comment key: "${titleSnippet}"`); continue; }

    for (const c of comments) {
      const user = userMap[c.author];
      if (!user) continue;
      const commentDoc = await Comment.create({
        postId: post._id,
        userId: user._id,
        content: c.content,
        likeCount: 0,
      });
      commentMap[c.content.substring(0, 40)] = commentDoc;
      commentCount++;
    }
  }
  console.log(`✅ Comments created: ${commentCount}`);

  // Replies
  for (const [commentSnippet, replies] of Object.entries(REPLY_DEFS)) {
    const commentKey = Object.keys(commentMap).find(k => k.includes(commentSnippet.substring(0, 20)) || commentSnippet.substring(0, 20).includes(k.substring(0, 15)));
    const comment = commentKey ? commentMap[commentKey] : null;
    if (!comment) { console.warn(`  ⚠ Comment not found for reply: "${commentSnippet}"`); continue; }

    for (const r of replies) {
      const user = userMap[r.author];
      if (!user) continue;
      await Reply.create({ commentId: comment._id, userId: user._id, content: r.content, likeCount: 0 });
      replyCount++;
    }
  }
  console.log(`✅ Replies created: ${replyCount}`);

  // ── Likes on Posts ───────────────────────────────────────────────────────
  const allPostDocs = Object.values(postMap);
  const likerPool = allUsers.slice(0, 60); // use whatever users exist
  let likeCount = 0;

  for (const post of allPostDocs) {
    const n = post.makePostAsQuery ? rand(8, 25) : rand(4, 40);
    const likers = pickN(likerPool, n);
    for (const liker of likers) {
      if (String(liker._id) === String(post.userId)) continue;
      try {
        await Like.create({ itemId: post._id, itemType: "Post", userId: liker._id, isLiked: true });
        likeCount++;
      } catch (e) { if (e.code !== 11000) console.error(`Like err: ${e.message}`); }
    }
    await Post.findByIdAndUpdate(post._id, { likeCount: likers.length });
  }

  // Likes on some comments
  const allCommentDocs = Object.values(commentMap);
  for (const comment of allCommentDocs) {
    const n = rand(1, 8);
    const likers = pickN(likerPool, n);
    for (const liker of likers) {
      if (String(liker._id) === String(comment.userId)) continue;
      try {
        await Like.create({ itemId: comment._id, itemType: "Comment", userId: liker._id, isLiked: true });
        likeCount++;
      } catch (e) { if (e.code !== 11000) console.error(`Like err: ${e.message}`); }
    }
    await Comment.findByIdAndUpdate(comment._id, { likeCount: n });
  }
  console.log(`✅ Likes created: ${likeCount}`);

  console.log("\n─────────────────────────────────────────");
  console.log(`  Community memberships : ${memberCount}`);
  console.log(`  Posts                 : ${postCount}`);
  console.log(`  Comments              : ${commentCount}`);
  console.log(`  Replies               : ${replyCount}`);
  console.log(`  Likes                 : ${likeCount}`);
  console.log("─────────────────────────────────────────");

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
