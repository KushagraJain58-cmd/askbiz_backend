// const mongoose = require("mongoose");
// const User = require("./src/models/users"); // adjust path
// const { Bussiness } = require("./src/models/users");

// const MONGO_URI = "mongodb+srv://jainkushagra582_db_user:LdlYlMonFnllWKwd@askbiz.qunpdsb.mongodb.net/?appName=AskBiz";

// async function importBusinessUsers() {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log("MongoDB Connected ✅");

//     await User.deleteMany({ accountType: "Bussiness" });
//     console.log("Old business users deleted 🚮");

//     // Dummy data
//     const businessUsers = [
//       {
//         username: "techworld01",
//         email: "techworld01@example.com",
//         password: "hashedpassword123",
//         phoneNumber: "9876543210",
//         accountType: "Bussiness",

//         businessName: "Tech World Pvt Ltd",
//         businessCategory: "Electronics",
//         establishmentYear: "2015",
//         businessContactNumber: "9876543210",
//         websiteURL: "https://techworld.com",
//         businessSize: "50-100",
//         products: "Mobile Phones, Laptops",
//         services: "Repair, Warranty",
//         description: "Leading electronics retailer",
//         photos: [
//           "https://via.placeholder.com/300",
//           "https://via.placeholder.com/400"
//         ],
//         adminApproval: "approved",
//         blueTick: true,

//         businessCountryFlag: "🇮🇳",
//         businessCountryCode: "+91",

//         location: {
//           type: "Point",
//           coordinates: [77.1025, 28.7041],
//           cityName: "Delhi"
//         }
//       },
//       {
//         username: "freshfoods",
//         email: "freshfoods@example.com",
//         password: "hashedpassword123",
//         phoneNumber: "9123456780",
//         accountType: "Bussiness",

//         businessName: "Fresh Foods Market",
//         businessCategory: "Grocery",
//         establishmentYear: "2018",
//         businessContactNumber: "9123456780",
//         websiteURL: "https://freshfoods.com",
//         businessSize: "10-50",
//         products: "Vegetables, Fruits",
//         services: "Home Delivery",
//         description: "Organic grocery store",
//         photos: [
//           "https://via.placeholder.com/300"
//         ],
//         adminApproval: "pending",
//         blueTick: false,

//         businessCountryFlag: "🇮🇳",
//         businessCountryCode: "+91",

//         location: {
//           type: "Point",
//           coordinates: [72.8777, 19.0760],
//           cityName: "Mumbai"
//         }
//       },
//       {
//         username: "buildmart",
//         email: "buildmart@example.com",
//         password: "hashedpassword123",
//         phoneNumber: "9988776655",
//         accountType: "Bussiness",

//         businessName: "BuildMart Supplies",
//         businessCategory: "Construction",
//         establishmentYear: "2010",
//         businessContactNumber: "9988776655",
//         websiteURL: "https://buildmart.com",
//         businessSize: "100-500",
//         products: "Cement, Steel",
//         services: "Bulk Supply",
//         description: "Construction material supplier",
//         photos: [],
//         adminApproval: "approved",
//         blueTick: true,

//         businessCountryFlag: "🇮🇳",
//         businessCountryCode: "+91",

//         location: {
//           type: "Point",
//           coordinates: [88.3639, 22.5726],
//           cityName: "Kolkata"
//         }
//       }
//     ];

//     // Insert using discriminator
//     const result = await Bussiness.insertMany(businessUsers);

//     console.log(`✅ Inserted ${result.length} business users`);

//     mongoose.disconnect();
//   } catch (error) {
//     console.error("❌ Error importing business users:", error);
//   }
// }

// importBusinessUsers();


const mongoose = require("mongoose");
const XLSX = require("xlsx");
const bcrypt = require("bcrypt");
const User = require("./src/models/users");
const { Bussiness } = require("./src/models/users");

const MONGO_URI =
  "mongodb+srv://jainkushagra582_db_user:LdlYlMonFnllWKwd@askbiz.qunpdsb.mongodb.net/?appName=AskBiz";

const EXCEL_PATH = "./B2B_FnB_Noida_Businesses.xlsx";

async function importBusinessUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected ✅");

    // Remove old business users
    await User.deleteMany({ accountType: "Bussiness" });
    console.log("Old business users deleted 🚮");

    // Read Excel file
    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Found ${rows.length} rows in Excel`);

    const businessUsers = await Promise.all(
      rows.map(async (row) => {
        const hashedPassword = await bcrypt.hash(
          String(row["Password"] || "123456"),
          10
        );

        return {
          username: String(row["Username"]),
          email: String(row["Email"]),
          password: hashedPassword,

          phoneNumber: String(row["Phone Number"] || ""),
          accountType: String(row["Account Type"] || "Bussiness"),

          businessName: row["Business Name"],
          businessCategory: row["Business Category"],

          establishmentYear: row["Establishment Year"]
            ? String(row["Establishment Year"])
            : "",

          businessContactNumber: String(
            row["Business Contact Number"] || ""
          ),

          websiteURL: row["Website URL"] || "",
          businessSize: row["Business Size"] || "",
          products: row["Products"] || "",
          services: row["Services"] || "",
          description: row["Description"] || "",

          photos: row["Photos"]
            ? String(row["Photos"])
                .split(",")
                .map((url) => url.trim())
                .filter(Boolean)
            : [],

          adminApproval: row["Admin Approval"] || "pending",
          blueTick:
            String(row["Blue Tick"]).toLowerCase() === "true",

          businessCountryCode: row["Country Code"]
            ? `${row["Country Code"]}`
            : "+91",

          location: {
            type: "Point",
            coordinates: [
              Number(row["Longitude"]) || 0,
              Number(row["Latitude"]) || 0,
            ],
            cityName: row["City Name"] || "",
          },

          status: row["Status"] || "active",
          phoneNumberVerified:
            String(row["Phone Number Verified"]).toLowerCase() ===
            "true",

          emailVerified:
            String(row["Email Verified"]).toLowerCase() ===
            "true",

          // interest: row["Interest"] || "",
          interest: row["Value"]
            ? [{
                interestType: row["Interest Type"] || "businessCategory",
                value: String(row["Value"])
                  .split(",")
                  .map(v => v.trim())
                  .filter(Boolean)
              }]
            : [],
          provider: row["Provider"] || "own",

          communityGuidelines:
            String(row["Community Guidelines"]).toLowerCase() ===
            "true",
        };
      })
    );
    console.log("businessUsers",businessUsers)
    // const result = await Bussiness.insertMany(businessUsers, {
    //   ordered: false,
    // });

    // console.log(`✅ Inserted ${result.length} business users`);
    try {

      console.log("Model:", Bussiness.modelName);
console.log("Collection:", Bussiness.collection.name);
  const result = await Bussiness.insertMany(businessUsers, {
    ordered: false,
  });
  console.log("Inserted:", result.length);
} catch (error) {
    console.error("FULL ERROR:");
    console.dir(error, { depth: null });

    if (error.writeErrors) {
        error.writeErrors.forEach((e, index) => {
            console.log(`Error ${index + 1}`);
            console.log(e.errmsg);
            console.log(e.err?.op);
        });
    }
}

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error importing business users:", error);
    process.exit(1);
  }
}

importBusinessUsers();