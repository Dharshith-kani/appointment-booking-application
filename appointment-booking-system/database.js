const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const db = new Database("appointments.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
);
CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  UNIQUE(date,start_time,end_time)
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  slot_id INTEGER NOT NULL REFERENCES slots(id),
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  CHECK(status IN ('pending','approved','rejected','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_appointments_slot_status ON appointments(slot_id,status);
`);

const adminEmail = "admin@OpenSlot.com";
if (!db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail)) {
  db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,'admin')")
    .run("OpenSlot Admin", adminEmail, bcrypt.hashSync("Admin@123", 10));
}
const count = db.prepare("SELECT COUNT(*) n FROM slots").get().n;
if (count === 0) {
  const insert = db.prepare("INSERT OR IGNORE INTO slots (date,start_time,end_time) VALUES (?,?,?)");
  const dates = [];
  const now = new Date();
  for (let i=1; i<=14; i++) {
    const d = new Date(now); d.setDate(now.getDate()+i);
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    dates.push(date);
  }
  const times = [["09:00","09:30"],["10:00","10:30"],["11:00","11:30"],["12:00","12:30"],["14:00","14:30"],["15:00","15:30"],["16:00","16:30"]];
  const seed = db.transaction(() => dates.forEach(date => times.forEach(t => insert.run(date,t[0],t[1]))));
  seed();
}
module.exports = db;
