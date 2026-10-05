import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB, disconnectDB } from "../lib/db";
import { User, Address, WorkerProfile, ServiceCategory, PaymentAccount } from "../lib/models";
import { PROFESSIONS } from "../lib/constants";

type Profession = (typeof PROFESSIONS)[number];

const CATEGORIES: { name: string; subs?: string[]; desc: string; icon: string }[] = [
  { name: "Electrical", desc: "House wiring, lighting, sockets, troubleshooting and installations.", icon: "⚡", subs: ["House wiring", "Light installation", "Socket installation", "Switch installation", "Circuit-breaker work", "Electrical troubleshooting", "Generator wiring", "Solar installation"] },
  { name: "Plumbing", desc: "Pipe repair, leaks, fixtures, drainage and water systems.", icon: "🔧", subs: ["Pipe repair", "Water leakage", "Sink installation", "Toilet repair", "Drain cleaning", "Water pump installation"] },
  { name: "Cleaning", desc: "Home, office, deep and post-construction cleaning.", icon: "🧼", subs: ["House cleaning", "Office cleaning", "Deep cleaning", "Post-construction cleaning", "Sofa & carpet cleaning"] },
  { name: "Carpentry", desc: "Furniture, doors, windows and custom woodwork.", icon: "🪚", subs: ["Furniture repair", "Door installation", "Window frames", "Custom furniture", "Shelving & cabinets"] },
  { name: "Painting", desc: "Interior/exterior painting and decorative finishes.", icon: "🎨", subs: ["Interior painting", "Exterior painting", "Wallpaper installation", "Surface preparation"] },
  { name: "Masonry", desc: "Brickwork, plastering, flooring and structural work.", icon: "🧱", subs: ["Bricklaying", "Plastering", "Tiling", "Concrete work", "Block laying"] },
  { name: "Welding & Metalwork", desc: "Gates, fences, frames and metal repairs.", icon: "🔥", subs: ["Gate fabrication", "Fence installation", "Metal repair", "Window grills"] },
  { name: "Roofing", desc: "Roof installation, repair and waterproofing.", icon: "🏠", subs: ["Roof repair", "Roof installation", "Leak proofing", "Gutter installation"] },
  { name: "Gardening", desc: "Landscaping, lawn care and garden maintenance.", icon: "🌿", subs: ["Lawn mowing", "Landscaping", "Tree trimming", "Garden maintenance"] },
  { name: "Mechanic", desc: "Vehicle repair and maintenance at your location.", icon: "🚗", subs: ["Engine repair", "Brake service", "Battery service", "General servicing"] },
  { name: "Appliance Repair", desc: "Home appliance diagnostics and repair.", icon: "🔌", subs: ["Refrigerator technician", "Washing machine repair", "TV repair", "Microwave repair", "Stove & oven repair"] },
  { name: "HVAC & Cooling", desc: "Air conditioning, heating and ventilation.", icon: "❄️", subs: ["AC installation", "AC servicing", "Ventilation repair", "Heating repair"] },
  { name: "Solar & Power", desc: "Solar, inverter and backup power systems.", icon: "☀️", subs: ["Solar panel installation", "Inverter setup", "Battery bank installation", "System maintenance"] },
  { name: "Handyman", desc: "Small repairs, mounting, assembly and general fixes.", icon: "🛠️", subs: ["TV mounting", "Furniture assembly", "Curtain installation", "General repairs"] },
  { name: "Construction", desc: "Building, renovation and site work.", icon: "🏗️", subs: ["Renovation", "Demolition", "Site preparation", "Finishing work"] },
  { name: "IT & Network", desc: "Computer, network and security systems.", icon: "💻", subs: ["Computer repair", "Network setup", "CCTV installation", "Software support", "Printer repair"] },
];

const WORKERS: {
  name: string;
  email: string;
  phone: string;
  profession: Profession;
  headline: string;
  bio: string;
  skills: string[];
  years: number;
  price: number;
  city: string;
  area: string;
  ratingSum: number;
  ratingCount: number;
  jobs: number;
  emergency: boolean;
  cats: string[];
}[] = [
  { name: "Abebe Tesfaye", email: "abebe@worker.et", phone: "+251911111111", profession: "Electrician", headline: "Licensed electrician — 12 years experience", bio: "I handle house wiring, installations and troubleshooting for homes, offices and construction sites. Safety first, clean work, fair prices.", skills: ["House wiring", "Light installation", "Circuit breakers", "Solar installation", "Troubleshooting"], years: 12, price: 800, city: "Addis Ababa", area: "Bole", ratingSum: 48, ratingCount: 10, jobs: 34, emergency: true, cats: ["Electrical", "Solar & Power"] },
  { name: "Selamawit Girma", email: "selam@worker.et", phone: "+251922222222", profession: "Plumber", headline: "Plumber for leaks, pipes and fixtures", bio: "Fast response for water leaks, pipe repairs, sink and toilet installation. I carry my own tools and source quality materials.", skills: ["Pipe repair", "Leak detection", "Drain cleaning", "Fixture installation"], years: 7, price: 600, city: "Addis Ababa", area: "Kazanchis", ratingSum: 41, ratingCount: 9, jobs: 27, emergency: true, cats: ["Plumbing"] },
  { name: "Dawit Bekele", email: "dawit@worker.et", phone: "+251933333333", profession: "Cleaner", headline: "Deep cleaning & post-construction crews", bio: "Professional cleaning for homes, offices and post-construction sites. Eco-friendly products available.", skills: ["Deep cleaning", "Post-construction", "Office cleaning", "Carpet cleaning"], years: 5, price: 450, city: "Addis Ababa", area: "Megenagna", ratingSum: 36, ratingCount: 8, jobs: 41, emergency: false, cats: ["Cleaning"] },
  { name: "Henok Alemu", email: "henok@worker.et", phone: "+251944444444", profession: "Carpenter", headline: "Custom furniture & door specialist", bio: "Furniture repair, custom cabinets, doors and windows. I work with hardwood and engineered boards.", skills: ["Furniture", "Cabinets", "Door installation", "Wood finishing"], years: 10, price: 900, city: "Bahir Dar", area: "Kefta", ratingSum: 27, ratingCount: 6, jobs: 19, emergency: false, cats: ["Carpentry"] },
  { name: "Meron Tadesse", email: "meron@worker.et", phone: "+251955555555", profession: "Painter", headline: "Interior & exterior painting", bio: "Clean painting work with proper surface preparation. Texture and decorative finishes available.", skills: ["Interior painting", "Exterior painting", "Wallpaper"], years: 6, price: 550, city: "Addis Ababa", area: "Sarbet", ratingSum: 32, ratingCount: 7, jobs: 23, emergency: true, cats: ["Painting"] },
];

async function seed() {
  await connectDB();
  console.log("Connected. Seeding...");

  await Promise.all([
    User.deleteMany({}),
    Address.deleteMany({}),
    WorkerProfile.deleteMany({}),
    ServiceCategory.deleteMany({}),
    PaymentAccount.deleteMany({}),
  ]);

  const admin = await User.create({
    role: "admin",
    name: "Platform Admin",
    email: "admin@homehelp.et",
    phone: "+251900000000",
    passwordHash: await bcrypt.hash("Admin123!", 10),
    gender: "",
    status: "active",
  });

  const customer = await User.create({
    role: "customer",
    name: "Hiwot Alemayehu",
    email: "customer@homehelp.et",
    phone: "+251912345678",
    passwordHash: await bcrypt.hash("Customer123!", 10),
    gender: "female",
    status: "active",
  });
  await Address.create({
    userId: customer._id,
    label: "Home",
    region: "Addis Ababa",
    city: "Addis Ababa",
    subCity: "Bole",
    woreda: "03",
    area: "Bole Rwanda",
    street: "12/34",
    isDefault: true,
  });

  const catIds: Record<string, mongoose.Types.ObjectId> = {};
  let order = 0;
  for (const c of CATEGORIES) {
    const parent = await ServiceCategory.create({
      name: c.name,
      slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: c.desc,
      icon: c.icon,
      order: order++,
    });
    catIds[c.name] = parent._id as mongoose.Types.ObjectId;
    for (const [i, s] of (c.subs || []).entries()) {
      await ServiceCategory.create({
        name: s,
        slug: `${c.name}-${s}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        parent: parent._id,
        order: i,
      });
    }
  }

  await PaymentAccount.create({
    bank: "Commercial Bank of Ethiopia",
    accountName: "Local Handyman Services",
    accountNumber: "1000123456789",
    branch: "Bole Branch, Addis Ababa",
    instructions:
      "1) Transfer the exact phase amount using your CBE app, CBE Birr, ATM or branch.\n2) Use your booking code as the payment remark/note.\n3) Return to Local Handyman and submit the payment proof with the transaction reference and screenshot.\n4) A platform verifier will review it manually — the website never receives your money.",
    active: true,
    order: 1,
  });

  for (const w of WORKERS) {
    const user = await User.create({
      role: "worker",
      name: w.name,
      email: w.email,
      phone: w.phone,
      passwordHash: await bcrypt.hash("Worker123!", 10),
      status: "active",
      phoneVerified: true,
    });
    await Address.create({
      userId: user._id,
      label: "Home",
      region: w.city === "Bahir Dar" ? "Amhara" : "Addis Ababa",
      city: w.city,
      area: w.area,
      isDefault: true,
    });
    await WorkerProfile.create({
      userId: user._id,
      profession: w.profession,
      headline: w.headline,
      bio: w.bio,
      skills: w.skills,
      yearsOfExperience: w.years,
      startingPrice: w.price,
      categoryIds: w.cats.map((c) => catIds[c]).filter(Boolean),
      serviceArea: {
        region: w.city === "Bahir Dar" ? "Amhara" : "Addis Ababa",
        city: w.city,
        woreda: "",
        radiusKm: 15,
      },
      availability: "available",
      emergencyAvailable: w.emergency,
      status: "approved",
      verifiedAt: new Date(),
      verifiedBy: admin._id,
      schedule: [
        { day: "mon", open: "08:00", close: "17:00", closed: false },
        { day: "tue", open: "08:00", close: "17:00", closed: false },
        { day: "wed", open: "08:00", close: "17:00", closed: false },
        { day: "thu", open: "08:00", close: "17:00", closed: false },
        { day: "fri", open: "08:00", close: "17:00", closed: false },
        { day: "sat", open: "09:00", close: "15:00", closed: false },
        { day: "sun", open: "09:00", close: "15:00", closed: true },
      ],
      documents: [
        { type: "id", title: "National ID", status: "approved", reviewNote: "", reviewedAt: new Date() },
        { type: "skill_certificate", title: "TVET Level III Certificate", status: "approved", reviewNote: "", reviewedAt: new Date() },
      ],
      portfolio: [
        {
          title: `${w.profession} project — complete installation`,
          category: w.cats[0],
          description: "Full job from inspection to completion with before/after evidence.",
          area: w.city,
          completedAt: new Date(Date.now() - 30 * 86400000),
          status: "published",
        },
      ],
      responseTimeMinutes: 18,
      stats: { jobsCompleted: w.jobs, jobsCancelled: 1, ratingSum: w.ratingSum, ratingCount: w.ratingCount },
      featured: w.jobs > 25,
    });
  }

  const counts = {
    users: await User.countDocuments(),
    categories: await ServiceCategory.countDocuments(),
    workers: await WorkerProfile.countDocuments(),
  };
  console.log("Seed complete:", counts);
  console.log("Accounts:");
  console.log("  admin:    admin@homehelp.et / Admin123!");
  console.log("  customer: customer@homehelp.et / Customer123!");
  console.log("  worker:   abebe@worker.et / Worker123!  (also selam@, dawit@, henok@, meron@worker.et)");
  await disconnectDB();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
