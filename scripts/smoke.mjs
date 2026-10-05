import fs from "fs";

const base = process.env.SMOKE_BASE || "http://localhost:3000";
const imgPath = new URL("../public/placeholder.jpg", import.meta.url);
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res) {
  const set = res.headers.getSetCookie?.() || [];
  for (const c of set) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (jar.size) headers.Cookie = cookieHeader();
  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(base + path, { ...opts, headers, body });
  storeCookies(res);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`${opts.method || "GET"} ${path} -> ${res.status}: ${json.error || JSON.stringify(json)}`);
  }
  return json.data;
}

function step(n) {
  console.log(`\n=== ${n} ===`);
}

// Like api(), but returns the status instead of throwing (for negative tests).
async function tryApi(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (jar.size) headers.Cookie = cookieHeader();
  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(base + path, { ...opts, headers, body });
  storeCookies(res);
  const json = await res.json().catch(() => ({}));
  return {
    status: res.status,
    ok: res.ok && json.ok !== false,
    data: json.data,
    error: json.error || "",
  };
}

async function login(email, password) {
  return api("/api/auth/login", { method: "POST", body: { email, password } });
}

const results = [];
function check(label, cond, detail = "") {
  results.push({ label, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  step("Login customer");
  const cust = await login("customer@homehelp.et", "Customer123!");
  check("customer login", cust.role === "customer", cust.email);

  step("Categories");
  const cats = await api("/api/categories");
  check("categories seeded", cats.categories.length > 80, `${cats.categories.length} categories`);
  const elec = cats.categories.find((c) => c.name === "Electrical")._id;

  step("Addresses");
  const addrs = await api("/api/addresses");
  check("default address", addrs.addresses.length > 0, addrs.addresses[0].label);

  step("Create service request");
  const req = await api("/api/requests", {
    method: "POST",
    body: {
      categoryId: elec,
      title: "Kitchen socket is sparking",
      urgency: "urgent",
      description: "The socket in my kitchen sparks when I plug in the cooker. Need urgent inspection.",
      addressId: addrs.addresses[0]._id,
      budget: 6000,
    },
  });
  check("request created", req.request.status === "open", `${req.request.reference} (${req.request.urgency})`);

  step("Worker availability feed + quotation");
  await login("abebe@worker.et", "Worker123!");
  const feed = await api("/api/requests?view=available");
  check("worker sees request", feed.total >= 1, `${feed.total} open requests`);
  const q = await api(`/api/requests/${req.request._id}/quotations`, {
    method: "POST",
    body: {
      laborCost: 3000,
      materialsCost: 2000,
      transportCost: 500,
      estimatedDuration: "6 hours",
      warrantyDays: 30,
      notes: "Includes new socket and wiring check",
    },
  });
  check("quotation submitted", q.quotation.total === 5500, `total ${q.quotation.total} ETB`);

  step("Customer accepts quotation -> booking");
  await login("customer@homehelp.et", "Customer123!");
  const acc = await api(`/api/quotations/${q.quotation._id}`, { method: "PATCH", body: { action: "accept" } });
  const bkId = acc.booking._id;
  check("booking created", acc.booking.status === "ADVANCE_PAYMENT_DUE", `${acc.booking.code} total=${acc.booking.agreedTotal}`);

  const bd = await api(`/api/bookings/${bkId}`);
  check("payment phases split", bd.paymentPhases.length === 3, bd.paymentPhases.map((p) => `${p.label}:${p.amount}:${p.status}`).join(" | "));
  check("job phases created", bd.jobPhases.length === 3, bd.jobPhases.map((p) => p.name).join(" | "));
  check("CBE account attached", !!bd.paymentPhases[0].paymentAccountId, bd.paymentPhases[0].paymentAccountId?.accountNumber);
  check("conversation created", !!bd.conversation);

  step("Submit CBE payment proof");
  const phase1 = bd.paymentPhases[0];
  const form = new FormData();
  form.append("amountPaid", String(phase1.amount));
  form.append("reference", "CBE99887766");
  form.append("senderName", "Hiwot Alemayehu");
  form.append("senderAccount", "1000555");
  form.append("paidAt", new Date().toISOString().slice(0, 10));
  form.append("note", "Advance via CBE Birr");
  form.append("screenshot", new Blob([fs.readFileSync(imgPath)], { type: "image/jpeg" }), "screenshot.jpg");
  const proof = await api(`/api/payments/phases/${phase1._id}/proof`, { method: "POST", body: form });
  check("proof submitted", proof.proof.status === "pending", `ref ${proof.proof.reference} ${proof.proof.amountPaid} ETB`);

  step("Duplicate reference detection");
  const form2 = new FormData();
  form2.append("amountPaid", String(phase1.amount));
  form2.append("reference", "CBE99887766");
  form2.append("senderName", "Hiwot Alemayehu");
  form2.append("paidAt", new Date().toISOString().slice(0, 10));
  form2.append("screenshot", new Blob([fs.readFileSync(imgPath)], { type: "image/jpeg" }), "s2.jpg");
  const dup = await api(`/api/payments/phases/${phase1._id}/proof`, { method: "POST", body: form2 });
  check("duplicate flagged", dup.proof.duplicateFlag === true, dup.warning);

  step("Admin verification center");
  await login("admin@homehelp.et", "Admin123!");
  const pending = await api("/api/payments/proofs?status=pending");
  check("pending queue", pending.total >= 1, `${pending.total} pending`);
  check("proof enriched with booking", !!pending.items[0].booking?.code, pending.items[0].booking?.code);

  const ver = await api(`/api/payments/proofs/${proof.proof._id}`, {
    method: "POST",
    body: { action: "verify", note: "Matched CBE statement" },
  });
  check("proof verified", ver.proof.status === "verified");
  check("phase verified", ver.phase.status === "VERIFIED", `paid ${ver.phase.paidVerified}`);
  check("next phase due", !!ver.nextPhaseId);

  const bd2 = await api(`/api/bookings/${bkId}`);
  check("summary updated", bd2.booking.paymentSummary.verified > 0, JSON.stringify(bd2.booking.paymentSummary));
  check("booking advanced", bd2.booking.status === "PAYMENT_VERIFIED", bd2.booking.status);

  step("Verify remaining phases");
  await login("customer@homehelp.et", "Customer123!");
  for (const ph of bd2.paymentPhases.filter((p) => p.status !== "VERIFIED")) {
    const f = new FormData();
    f.append("amountPaid", String(ph.amount));
    f.append("reference", `CBE${Math.floor(Math.random() * 9e7 + 1e7)}`);
    f.append("senderName", "Hiwot Alemayehu");
    f.append("paidAt", new Date().toISOString().slice(0, 10));
    f.append("screenshot", new Blob([fs.readFileSync(imgPath)], { type: "image/jpeg" }), "s.jpg");
    const p2 = await api(`/api/payments/phases/${ph._id}/proof`, { method: "POST", body: f });
    await login("admin@homehelp.et", "Admin123!");
    await api(`/api/payments/proofs/${p2.proof._id}`, { method: "POST", body: { action: "verify" } });
    await login("customer@homehelp.et", "Customer123!");
  }
  const bd3 = await api(`/api/bookings/${bkId}`);
  check("all phases verified", bd3.paymentPhases.every((p) => p.status === "VERIFIED"), bd3.paymentPhases.map((p) => p.status).join(","));
  check("booking scheduled", ["PAYMENT_VERIFIED", "SCHEDULED"].includes(bd3.booking.status), bd3.booking.status);

  step("Work start gate (before verification would fail) + status flow");
  await login("abebe@worker.et", "Worker123!");
  let s = await api(`/api/bookings/${bkId}/status`, { method: "POST", body: { status: "SCHEDULED" } });
  s = await api(`/api/bookings/${bkId}/status`, { method: "POST", body: { status: "WORKER_ON_THE_WAY" } });
  s = await api(`/api/bookings/${bkId}/status`, { method: "POST", body: { status: "WORK_STARTED" } });
  check("work started", s.booking.status === "WORK_STARTED");

  const phasesUpd = await api(`/api/job-phases/${bd3.jobPhases[0]._id}`, {
    method: "PATCH",
    body: { status: "COMPLETED" },
  });
  check("job phase completed", phasesUpd.phase.status === "COMPLETED", `progress ${phasesUpd.progressPercent}%`);

  s = await api(`/api/bookings/${bkId}/status`, { method: "POST", body: { status: "IN_PROGRESS", progressPercent: 66 } });
  s = await api(`/api/bookings/${bkId}/status`, { method: "POST", body: { status: "COMPLETED" } });
  check("job completed by worker", s.booking.status === "COMPLETED");

  step("Customer confirms + reviews");
  await login("customer@homehelp.et", "Customer123!");
  const cf = await api(`/api/bookings/${bkId}/status`, { method: "POST", body: { status: "CUSTOMER_CONFIRMED" } });
  check("booking closed", cf.booking.status === "CLOSED", cf.booking.status);
  const rv = await api(`/api/bookings/${bkId}/review`, {
    method: "POST",
    body: { overall: 5, quality: 5, punctuality: 5, text: "Excellent, fast and clean work." },
  });
  check("review created", rv.review.overall === 5);

  step("Messaging");
  const workers = await api("/api/workers?q=electrician");
  const conv = await api("/api/conversations", { method: "POST", body: { workerId: workers.items[0].userId } });
  const msg = await api(`/api/conversations/${conv.conversation._id}/messages`, {
    method: "POST",
    body: { text: "Hello, thanks for the great work!" },
  });
  check("message sent", msg.message.text.length > 0);
  const convs = await api("/api/conversations");
  check("conversation listed", convs.conversations.length >= 1, `${convs.conversations.length} conversations`);

  step("Notifications");
  const nt = await api("/api/notifications");
  check("customer has notifications", nt.items.length > 0, `${nt.unread} unread of ${nt.items.length}`);

  step("Search & filters");
  const search = await api("/api/workers?q=plumber&sort=rating");
  check("search works", search.total >= 1, `${search.total} plumbers`);
  const emg = await api("/api/workers?emergency=1&verified=1");
  check("emergency filter", emg.items.every((i) => i.emergencyAvailable && i.verified), `${emg.total} emergency verified`);

  step("Worker public profile");
  const wp = await api(`/api/workers/${workers.items[0].userId}`);
  check("public profile", wp.worker.verified === true && wp.reviews.length >= 1, `${wp.worker.name} rating=${wp.worker.rating}`);

  step("Payment history");
  const hist = await api("/api/payments/history");
  check("history totals", hist.totals.verified > 0, JSON.stringify(hist.totals));

  step("Admin stats & audit");
  await login("admin@homehelp.et", "Admin123!");
  const stats = await api("/api/admin/stats");
  check("admin stats", stats.totals.totalCustomers >= 1 && stats.totals.verifiedProofs >= 1, `verifiedProofs=${stats.totals.verifiedProofs} amt=${stats.totals.verifiedAmount}`);
  const audit = await api("/api/admin/audit");
  check("audit log", audit.total >= 5, `${audit.total} entries`);
  const users = await api("/api/admin/users?role=worker");
  check("admin user list", users.total >= 5, `${users.total} workers`);
  const wq = await api("/api/admin/workers?status=approved");
  check("worker verification queue", wq.total >= 5, `${wq.total} approved`);

  step("Universal feed (TC-FEED)");
  await login("customer@homehelp.et", "Customer123!");
  const otherCat = cats.categories.find((c) => !["Electrical", "Solar & Power"].includes(c.name));
  const farReq = await api("/api/requests", {
    method: "POST",
    body: {
      categoryId: otherCat._id,
      title: "Burst pipe flooding the yard",
      urgency: "urgent",
      description: "A water pipe burst in the yard and the compound is flooding. Needs a plumber today.",
      city: "Adama",
      locationLabel: "Adama, behind the market",
      budget: 4500,
    },
  });
  check("out-of-city request created", farReq.request.status === "open", `${farReq.request.reference} in Adama`);

  const cancelReq = await api("/api/requests", {
    method: "POST",
    body: {
      categoryId: elec,
      title: "Broken dimmer switch",
      urgency: "normal",
      description: "The dimmer switch in the dining room stopped working and needs replacing.",
      addressId: addrs.addresses[0]._id,
      budget: 800,
    },
  });
  await api(`/api/requests/${cancelReq.request._id}`, { method: "PATCH", body: { action: "cancel" } });

  await login("selam@worker.et", "Worker123!");
  const farQuote = await api(`/api/requests/${farReq.request._id}/quotations`, {
    method: "POST",
    body: { laborCost: 3800, estimatedDuration: "3 hours", notes: "Pipe repair and pressure test." },
  });
  check("second worker quoted far request", farQuote.quotation.total === 3800);

  await login("abebe@worker.et", "Worker123!");
  const feedAll = await api("/api/requests?view=available&limit=50");
  const farItem = feedAll.items.find((i) => i._id === farReq.request._id);
  check("TC-FEED-01 other category + other city visible", !!farItem && farItem.location?.city === "Adama", farItem ? `${farItem.categoryId?.name} / ${farItem.location?.city}` : "not in feed");
  check("TC-FEED-02 quoted request still in feed", !!farItem && farItem.status === "quoted", farItem?.status);
  check("TC-FEED-03 booked request hidden", !feedAll.items.some((i) => i._id === req.request._id), "booking_created excluded");
  check("TC-FEED-04 cancelled request hidden", !feedAll.items.some((i) => i._id === cancelReq.request._id), "cancelled excluded");
  check(
    "TC-FEED-08 cards carry quotation counts",
    !!farItem && typeof farItem.quotationCount === "number" && farItem.quotationCount >= 1 && feedAll.items.every((i) => typeof i.quotationCount === "number"),
    farItem ? `${farItem.quotationCount} quotes on far request` : "missing"
  );

  const fCat = await api(`/api/requests?view=available&category=${elec}&limit=50`);
  check("TC-FEED-06 category filter applies", fCat.items.every((i) => i.categoryId?._id === elec) && !fCat.items.some((i) => i._id === farReq.request._id), `${fCat.total} in category`);
  const fEmg = await api("/api/requests?view=available&emergency=1&limit=50");
  check("TC-FEED-06 emergency filter applies", fEmg.items.every((i) => ["emergency", "urgent"].includes(i.urgency)) && fEmg.items.some((i) => i._id === farReq.request._id), `${fEmg.total} urgent`);

  const detailOther = await api(`/api/requests/${farReq.request._id}`);
  check("TC-FEED-05 quoted request opens for another worker", !!detailOther.request && detailOther.myQuotation === null, detailOther.request.status);

  step("Accept job (TC-ACC)");
  await login("customer@homehelp.et", "Customer123!");
  const accReq = await api("/api/requests", {
    method: "POST",
    body: {
      categoryId: elec,
      title: "Install two ceiling fans",
      urgency: "normal",
      description: "Two ceiling fans to install in the living room and main bedroom. Wiring already exists.",
      addressId: addrs.addresses[0]._id,
      budget: 4500,
    },
  });
  const accCustomerId = String(accReq.request.customerId?._id || accReq.request.customerId);

  await login("abebe@worker.et", "Worker123!");
  const a1 = await api(`/api/requests/${accReq.request._id}/accept`, { method: "POST" });
  check("TC-ACC-01 accept priced at budget", a1.quotation.total === 4500 && a1.quotation.status === "pending", `total ${a1.quotation.total} ${a1.quotation.status}`);
  check("TC-ACC-01 offer marked source=accept", a1.quotation.source === "accept", a1.quotation.source);
  check("TC-ACC-01 default plan 30/40/30", a1.quotation.paymentPlan.map((p) => p.percent).join("/") === "30/40/30");
  const afterAccept = await api(`/api/requests/${accReq.request._id}`);
  check("TC-ACC-01 request moved to quoted", afterAccept.request.status === "quoted", afterAccept.request.status);

  const again = await tryApi(`/api/requests/${accReq.request._id}/accept`, { method: "POST", body: { price: 1 } });
  check("TC-ACC-09 second accept rejected", again.status === 409, `status ${again.status}`);

  await login("customer@homehelp.et", "Customer123!");
  const zeroReq = await api("/api/requests", {
    method: "POST",
    body: {
      categoryId: elec,
      title: "Replace a broken light switch",
      urgency: "normal",
      description: "The corridor light switch is broken and needs replacing today.",
      addressId: addrs.addresses[0]._id,
      budget: 0,
    },
  });
  await login("abebe@worker.et", "Worker123!");
  const noPrice = await tryApi(`/api/requests/${zeroReq.request._id}/accept`, { method: "POST" });
  check("TC-ACC-03 zero budget without price rejected", noPrice.status === 400, `status ${noPrice.status}: ${noPrice.error}`);
  const a2 = await api(`/api/requests/${zeroReq.request._id}/accept`, { method: "POST", body: { price: 6000 } });
  check("TC-ACC-02 negotiated price used", a2.quotation.total === 6000, `total ${a2.quotation.total}`);

  await login("customer@homehelp.et", "Customer123!");
  const ntCust = await api("/api/notifications");
  const accNotif = ntCust.items.find((n) => n.type === "quotation_received" && n.link === `/dashboard/customer/requests/${accReq.request._id}`);
  check("TC-ACC-04 customer notified with request link", !!accNotif, accNotif ? `${accNotif.title} → ${accNotif.link}` : "no notification");

  await login("admin@homehelp.et", "Admin123!");
  const wlist = await api("/api/admin/workers?limit=50");
  const meron = wlist.items.find((i) => i.user?.email === "meron@worker.et");
  check("meron profile located", !!meron?._id, meron?.user?.email || "");
  await api(`/api/admin/workers/${meron._id}/verify`, { method: "POST", body: { action: "reactivate" } });
  await login("meron@worker.et", "Worker123!");
  const pendingTry = await tryApi(`/api/requests/${accReq.request._id}/accept`, { method: "POST", body: { price: 500 } });
  check("TC-ACC-06 unapproved profile rejected", pendingTry.status === 403, `status ${pendingTry.status}`);
  await login("admin@homehelp.et", "Admin123!");
  await api(`/api/admin/workers/${meron._id}/verify`, { method: "POST", body: { action: "approve", note: "Restored after smoke test" } });

  await login("selam@worker.et", "Worker123!");
  await api("/api/worker/profile", { method: "PATCH", body: { availability: "offline" } });
  const offlineTry = await tryApi(`/api/requests/${accReq.request._id}/accept`, { method: "POST", body: { price: 500 } });
  check("TC-ACC-07 offline worker rejected", offlineTry.status === 409, `status ${offlineTry.status}`);
  await api("/api/worker/profile", { method: "PATCH", body: { availability: "available" } });

  const bookedTry = await tryApi(`/api/requests/${req.request._id}/accept`, { method: "POST", body: { price: 500 } });
  check("TC-ACC-10 booked request rejected", bookedTry.status === 409, `status ${bookedTry.status}`);

  const competing = await api(`/api/requests/${accReq.request._id}/quotations`, {
    method: "POST",
    body: { laborCost: 5000, estimatedDuration: "1 day" },
  });
  check("competing offer pending", competing.quotation.status === "pending", `total ${competing.quotation.total}`);

  await login("customer@homehelp.et", "Customer123!");
  const confirm = await api(`/api/quotations/${a1.quotation._id}`, { method: "PATCH", body: { action: "accept" } });
  check("TC-ACC-05 booking created from accept offer", !!confirm.booking?._id && confirm.booking.agreedTotal === 4500, `${confirm.booking?.code} total=${confirm.booking?.agreedTotal}`);

  await login("selam@worker.et", "Worker123!");
  const ntSelam = await api("/api/notifications");
  const closedNotif = ntSelam.items.find((n) => n.type === "quotation_closed" && n.link.includes(accReq.request._id));
  check("TC-ACC-11 losing offer auto-rejected + notified", !!closedNotif, closedNotif ? closedNotif.link : "no notification");
  check("TC-FIX-01 worker notification link is role-correct", !!closedNotif && closedNotif.link.startsWith("/dashboard/worker/"), closedNotif ? closedNotif.link : "");

  step("Pre-acceptance messaging (TC-CHAT)");
  await login("abebe@worker.et", "Worker123!");
  const abebeMe = await api("/api/auth/me");
  const abebeId = String(abebeMe.user._id);

  const t1 = await api("/api/conversations", { method: "POST", body: { customerId: accCustomerId } });
  const t1c = t1.conversation;
  const participants = (t1c.participants || []).map((p) => String(p?._id || p)).sort().join("|");
  check("TC-CHAT-01 pre-booking thread has no booking", !t1c.bookingId, `bookingId=${JSON.stringify(t1c.bookingId)}`);
  check("TC-CHAT-01 participants are the pair", participants === [accCustomerId, abebeId].sort().join("|"), participants);

  const t2 = await api("/api/conversations", { method: "POST", body: { customerId: accCustomerId } });
  check("TC-CHAT-02 repeat returns same thread", t2.conversation._id === t1c._id, `${t1c._id} vs ${t2.conversation._id}`);

  const abebeConvs = await api("/api/conversations");
  const bookingThread = abebeConvs.conversations.find((c) => !!c.bookingId);
  check("TC-CHAT-05 booking thread exists separately", !!bookingThread && bookingThread._id !== t1c._id, bookingThread ? `${bookingThread.bookingId?.code}` : "no booking thread");

  await api(`/api/conversations/${t1c._id}/messages`, { method: "POST", body: { text: "Hello, I can install both fans today." } });

  await login("customer@homehelp.et", "Customer123!");
  const cConvs = await api("/api/conversations");
  const custThread = cConvs.conversations.find((c) => c._id === t1c._id);
  check("TC-CHAT-04 worker message visible to customer", !!custThread && custThread.lastMessage.includes("both fans"), custThread?.lastMessage);
  const ntMsg = await api("/api/notifications");
  const linkNotif = ntMsg.items.find((n) => n.type === "new_message" && n.link === `/dashboard/customer/messages/${t1c._id}`);
  check("TC-CHAT-03/TC-FIX-01 role-correct notification link", !!linkNotif, linkNotif ? linkNotif.link : "no notification");

  await api(`/api/conversations/${t1c._id}/messages`, { method: "POST", body: { text: "Great, come at 3pm." } });

  await login("abebe@worker.et", "Worker123!");
  const wConvs = await api("/api/conversations");
  const wThread = wConvs.conversations.find((c) => c._id === t1c._id);
  check("TC-CHAT-04 customer reply visible to worker", !!wThread && wThread.lastMessage.includes("3pm"), wThread?.lastMessage);

  const legacy = await api("/api/conversations", { method: "POST", body: { workerId: abebeId } });
  check("TC-CHAT-06 legacy workerId=me still works", !!legacy.conversation?._id, legacy.conversation?._id);

  await login("admin@homehelp.et", "Admin123!");
  const adminBad = await tryApi("/api/conversations", { method: "POST", body: { workerId: abebeId } });
  check("TC-CHAT-07 admin must name both parties", adminBad.status === 400, `status ${adminBad.status}`);

  const savedJar = new Map(jar);
  jar.clear();
  const anon = await tryApi("/api/conversations", { method: "POST", body: { customerId: accCustomerId } });
  check("TC-CHAT-08 unauthenticated send rejected", anon.status === 401, `status ${anon.status}`);
  for (const [k, v] of savedJar) jar.set(k, v);

  step("RBAC negative tests");
  await login("customer@homehelp.et", "Customer123!");
  let denied = false;
  try {
    await api("/api/admin/stats");
  } catch {
    denied = true;
  }
  check("customer blocked from admin", denied);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n==============================`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  FAIL: ${f.label} ${f.detail}`));
    process.exit(1);
  }
  console.log("SMOKE TEST OK");
}

main().catch((err) => {
  console.error("\nSMOKE TEST ERROR:", err.message);
  process.exit(1);
});
