require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Please sign in to continue." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
}
function sendError(res, error) {
  console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
}

app.post("/api/auth/register", (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res.status(400).json({ message: "Enter your name, a valid email and a password with at least 6 characters." });
    const normalizedEmail = email.trim().toLowerCase();
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail))
      return res.status(409).json({ message: "An account with this email already exists." });
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,'user')")
      .run(name.trim(), normalizedEmail, hash);
    const user = { id: result.lastInsertRowid, name: name.trim(), email: normalizedEmail, role: "user" };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user });
  } catch (e) { sendError(res, e); }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").trim().toLowerCase());
    if (!row || !bcrypt.compareSync(password || "", row.password))
      return res.status(401).json({ message: "Incorrect email or password." });
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user });
  } catch (e) { sendError(res, e); }
});

app.get("/api/me", auth, (req, res) => res.json({ user: req.user }));

app.get("/api/slots", (req, res) => {
  try {
    const date = req.query.date;
    const slots = db.prepare(`
      SELECT s.id, s.date, s.start_time, s.end_time,
      CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS booked
      FROM slots s LEFT JOIN appointments a ON a.slot_id=s.id AND a.status IN ('pending','approved')
      WHERE s.date >= date('now') AND (? IS NULL OR s.date=?)
      ORDER BY s.date, s.start_time
    `).all(date || null, date || null);
    res.json({ slots });
  } catch (e) { sendError(res, e); }
});

app.post("/api/appointments", auth, (req, res) => {
  try {
    const { slotId, reason } = req.body;
    const slot = db.prepare("SELECT * FROM slots WHERE id=? AND date >= date('now')").get(slotId);
    if (!slot) return res.status(404).json({ message: "That time slot is no longer available." });
    const occupied = db.prepare("SELECT id FROM appointments WHERE slot_id=? AND status IN ('pending','approved')").get(slotId);
    if (occupied) return res.status(409).json({ message: "This slot has already been booked. Choose another time." });
    const result = db.prepare("INSERT INTO appointments (user_id,slot_id,reason,status,created_at) VALUES (?,?,?,'pending',datetime('now'))")
      .run(req.user.id, slotId, (reason || "").trim());
    res.status(201).json({ message: "Your appointment request has been submitted.", appointmentId: result.lastInsertRowid });
  } catch (e) { sendError(res, e); }
});

app.get("/api/appointments/mine", auth, (req, res) => {
  try {
    const appointments = db.prepare(`
      SELECT a.id,a.reason,a.status,a.created_at,s.date,s.start_time,s.end_time
      FROM appointments a JOIN slots s ON s.id=a.slot_id
      WHERE a.user_id=? ORDER BY s.date DESC,s.start_time DESC
    `).all(req.user.id);
    res.json({ appointments });
  } catch (e) { sendError(res, e); }
});

app.patch("/api/appointments/:id/cancel", auth, (req, res) => {
  try {
    const item = db.prepare("SELECT * FROM appointments WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ message: "Appointment not found." });
    if (item.status === "cancelled" || item.status === "rejected")
      return res.status(400).json({ message: "This appointment cannot be cancelled." });
    db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(item.id);
    res.json({ message: "Appointment cancelled." });
  } catch (e) { sendError(res, e); }
});

/* Admin API */
app.get("/api/admin/overview", auth, adminOnly, (req, res) => {
  try {
    const stats = {
      total: db.prepare("SELECT COUNT(*) n FROM appointments").get().n,
      pending: db.prepare("SELECT COUNT(*) n FROM appointments WHERE status='pending'").get().n,
      approved: db.prepare("SELECT COUNT(*) n FROM appointments WHERE status='approved'").get().n,
      slots: db.prepare("SELECT COUNT(*) n FROM slots WHERE date >= date('now')").get().n
    };
    res.json({ stats });
  } catch (e) { sendError(res, e); }
});

app.get("/api/admin/appointments", auth, adminOnly, (req, res) => {
  try {
    const appointments = db.prepare(`
      SELECT a.id,a.reason,a.status,a.created_at,u.name,u.email,s.date,s.start_time,s.end_time
      FROM appointments a JOIN users u ON u.id=a.user_id JOIN slots s ON s.id=a.slot_id
      ORDER BY s.date DESC,s.start_time DESC
    `).all();
    res.json({ appointments });
  } catch (e) { sendError(res, e); }
});

app.patch("/api/admin/appointments/:id", auth, adminOnly, (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected", "pending"].includes(status))
    return res.status(400).json({ message: "Invalid appointment status." });
  try {
    const item = db.prepare("SELECT * FROM appointments WHERE id=?").get(req.params.id);
    if (!item) return res.status(404).json({ message: "Appointment not found." });
    if (status === "approved") {
      const conflict = db.prepare("SELECT id FROM appointments WHERE slot_id=? AND status='approved' AND id<>?").get(item.slot_id, item.id);
      if (conflict) return res.status(409).json({ message: "Another appointment has already been approved for this slot." });
    }
    db.prepare("UPDATE appointments SET status=? WHERE id=?").run(status, item.id);
    res.json({ message: `Appointment ${status}.` });
  } catch (e) { sendError(res, e); }
});

app.post("/api/admin/slots", auth, adminOnly, (req, res) => {
  const { date, startTime, endTime } = req.body;
  if (!date || !startTime || !endTime || startTime >= endTime)
    return res.status(400).json({ message: "Enter a valid date, start time and end time." });
  try {
    const result = db.prepare("INSERT INTO slots (date,start_time,end_time) VALUES (?,?,?)")
      .run(date, startTime, endTime);
    res.status(201).json({ message: "Availability added.", slotId: result.lastInsertRowid });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ message: "That time slot already exists." });
    sendError(res, e);
  }
});

app.delete("/api/admin/slots/:id", auth, adminOnly, (req, res) => {
  try {
    const slot = db.prepare("SELECT id FROM slots WHERE id=?").get(req.params.id);
    if (!slot) return res.status(404).json({ message: "Slot not found." });
    const used = db.prepare("SELECT id FROM appointments WHERE slot_id=? AND status IN ('pending','approved')").get(slot.id);
    if (used) return res.status(409).json({ message: "This slot has an active booking and cannot be removed." });
    db.prepare("DELETE FROM slots WHERE id=?").run(slot.id);
    res.json({ message: "Availability removed." });
  } catch (e) { sendError(res, e); }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`Appointment app running at http://localhost:${PORT}`));
