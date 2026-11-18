require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;
const origins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map((o) => o.trim()) : "*";

app.use(cors({ origin: origins }));
app.use(express.json());

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" },
    dueDate: { type: Date }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Task = mongoose.model("Task", taskSchema);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email });

const auth = wrap(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Not authorized" });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Session expired, please log in again" });
  }
  const user = await User.findById(payload.id).select("-password");
  if (!user) return res.status(401).json({ message: "User not found" });
  req.user = user;
  next();
});

app.get("/", (req, res) => res.json({ status: "ok", service: "TaskFlow API" }));

app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  })
);

app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "Invalid email or password" });
    res.json({ token: sign(user), user: publicUser(user) });
  })
);

app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get(
  "/api/tasks",
  auth,
  wrap(async (req, res) => {
    const { status, priority, search } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) filter.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  })
);

app.get(
  "/api/tasks/stats",
  auth,
  wrap(async (req, res) => {
    const rows = await Task.aggregate([{ $match: { user: req.user._id } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
    const stats = { total: 0, todo: 0, "in-progress": 0, done: 0 };
    rows.forEach((r) => {
      stats[r._id] = r.count;
      stats.total += r.count;
    });
    res.json(stats);
  })
);

app.post(
  "/api/tasks",
  auth,
  wrap(async (req, res) => {
    const { title, description, priority, status, dueDate } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const task = await Task.create({ user: req.user._id, title, description, priority, status, dueDate: dueDate || undefined });
    res.status(201).json(task);
  })
);

app.put(
  "/api/tasks/:id",
  auth,
  wrap(async (req, res) => {
    const allowed = ["title", "description", "priority", "status", "dueDate"];
    const update = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k] === "" && k === "dueDate" ? null : req.body[k];
    });
    const task = await Task.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, update, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  })
);

app.delete(
  "/api/tasks/:id",
  auth,
  wrap(async (req, res) => {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted" });
  })
);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

app.use((err, req, res, next) => {
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid id" });
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
