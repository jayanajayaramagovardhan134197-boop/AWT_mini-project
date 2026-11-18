import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import axios from "axios";

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const errMsg = (e) => e.response?.data?.message || (e.request ? "Cannot reach server. It may be waking up, try again in 30 seconds." : e.message);

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return setLoading(false);
    api
      .get("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const save = (data) => {
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const login = async (email, password) => save((await api.post("/auth/login", { email, password })).data);
  const register = async (name, email, password) => save((await api.post("/auth/register", { name, email, password })).data);
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading...</div>;
  return user ? <Navigate to="/" replace /> : children;
}

function AuthForm({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1 className="brand">TaskFlow</h1>
        <p className="muted">{isLogin ? "Welcome back. Log in to your tasks." : "Create an account to get started."}</p>
        {error && <div className="alert">{error}</div>}
        {!isLogin && <input placeholder="Full name" value={form.name} onChange={set("name")} required />}
        <input type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={set("password")} minLength={6} required />
        <button className="btn primary" disabled={busy}>{busy ? "Please wait..." : isLogin ? "Log in" : "Sign up"}</button>
        <p className="muted small">
          {isLogin ? "No account? " : "Already registered? "}
          <Link to={isLogin ? "/register" : "/login"}>{isLogin ? "Sign up" : "Log in"}</Link>
        </p>
      </form>
    </div>
  );
}

const emptyTask = { title: "", description: "", priority: "medium", status: "todo", dueDate: "" };
const statusLabel = { todo: "To Do", "in-progress": "In Progress", done: "Done" };

function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(task ? { ...emptyTask, ...task, dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "" } : emptyTask);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{task ? "Edit task" : "New task"}</h2>
        {error && <div className="alert">{error}</div>}
        <input placeholder="Title" value={form.title} onChange={set("title")} required autoFocus />
        <textarea placeholder="Description" rows={3} value={form.description} onChange={set("description")} />
        <div className="row">
          <label>
            Priority
            <select value={form.priority} onChange={set("priority")}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={set("status")}>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={form.dueDate} onChange={set("dueDate")} />
          </label>
        </div>
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, onStatus }) {
  const overdue = task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date(new Date().toDateString());
  return (
    <div className={`card task ${task.status === "done" ? "is-done" : ""}`}>
      <div className="task-head">
        <span className={`pill ${task.priority}`}>{task.priority}</span>
        {task.dueDate && <span className={`due ${overdue ? "overdue" : ""}`}>{overdue ? "Overdue · " : "Due "}{new Date(task.dueDate).toLocaleDateString()}</span>}
      </div>
      <h3>{task.title}</h3>
      {task.description && <p className="muted">{task.description}</p>}
      <div className="task-foot">
        <select value={task.status} onChange={(e) => onStatus(task, e.target.value)}>
          {Object.entries(statusLabel).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <div className="actions">
          <button className="btn small" onClick={() => onEdit(task)}>Edit</button>
          <button className="btn small danger" onClick={() => onDelete(task)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, todo: 0, "in-progress": 0, done: 0 });
  const [filters, setFilters] = useState({ status: "", priority: "", search: "" });
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const [t, s] = await Promise.all([api.get("/tasks", { params }), api.get("/tasks/stats")]);
      setTasks(t.data);
      setStats(s.data);
      setError("");
    } catch (err) {
      if (err.response?.status === 401) return logout();
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [filters, logout]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  const save = async (form) => {
    if (modal?._id) await api.put(`/tasks/${modal._id}`, form);
    else await api.post("/tasks", form);
    load();
  };

  const remove = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    await api.delete(`/tasks/${task._id}`);
    load();
  };

  const changeStatus = async (task, status) => {
    await api.put(`/tasks/${task._id}`, { status });
    load();
  };

  const progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="brand">TaskFlow</h1>
        <div className="row">
          <span className="muted">Hi, {user.name}</span>
          <button className="btn" onClick={logout}>Log out</button>
        </div>
      </header>

      <section className="stats">
        <div className="card stat"><span>Total</span><strong>{stats.total}</strong></div>
        <div className="card stat"><span>To Do</span><strong>{stats.todo}</strong></div>
        <div className="card stat"><span>In Progress</span><strong>{stats["in-progress"]}</strong></div>
        <div className="card stat"><span>Done</span><strong>{stats.done}</strong></div>
        <div className="card stat wide">
          <span>Completion {progress}%</span>
          <div className="bar"><div style={{ width: `${progress}%` }} /></div>
        </div>
      </section>

      <section className="toolbar">
        <input placeholder="Search tasks..." value={filters.search} onChange={setF("search")} />
        <select value={filters.status} onChange={setF("status")}>
          <option value="">All status</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select value={filters.priority} onChange={setF("priority")}>
          <option value="">All priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button className="btn primary" onClick={() => setModal({})}>+ New task</button>
      </section>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="center">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="card empty">No tasks found. Create your first task.</div>
      ) : (
        <section className="grid">
          {tasks.map((t) => (
            <TaskCard key={t._id} task={t} onEdit={setModal} onDelete={remove} onStatus={changeStatus} />
          ))}
        </section>
      )}

      {modal && <TaskModal task={modal._id ? modal : null} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/login" element={<Guest><AuthForm mode="login" /></Guest>} />
        <Route path="/register" element={<Guest><AuthForm mode="register" /></Guest>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
