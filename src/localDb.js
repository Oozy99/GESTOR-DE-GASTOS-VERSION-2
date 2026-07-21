// ─────────────────────────────────────────────────────────────────────────────
// localDb.js — Reemplazo 100% local de Supabase.
// Toda la información se guarda en localStorage del navegador/dispositivo.
// No hay llamadas de red, no hay backend, no hay costos.
// ─────────────────────────────────────────────────────────────────────────────

const DB_KEY = 'expenseTrackerDB_v1';

const emptyDB = () => ({
  gastos_fijos: [],
  gastos_generales: [],
  categorias: [],
  sueldos: [],
});

const readDB = () => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw);
    return { ...emptyDB(), ...parsed };
  } catch {
    return emptyDB();
  }
};

const writeDB = (db) => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('No se pudo guardar en localStorage', e);
  }
};

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ─── GASTOS FIJOS ─────────────────────────────────────────────────────────

export const getGastosFijos = async (uid) => {
  const db = readDB();
  const data = db.gastos_fijos
    .filter((r) => r.usuario_id === uid)
    .sort((a, b) => (a.fecha_renovacion || '').localeCompare(b.fecha_renovacion || ''));
  return { data };
};

export const insertGastoFijo = async (payload) => {
  const db = readDB();
  const row = { id: genId(), ...payload };
  db.gastos_fijos.push(row);
  writeDB(db);
  return { data: row };
};

export const updateGastoFijo = async (id, payload) => {
  const db = readDB();
  const idx = db.gastos_fijos.findIndex((r) => r.id === id);
  if (idx === -1) return { data: null };
  db.gastos_fijos[idx] = { ...db.gastos_fijos[idx], ...payload };
  writeDB(db);
  return { data: db.gastos_fijos[idx] };
};

export const deleteGastoFijo = async (id) => {
  const db = readDB();
  db.gastos_fijos = db.gastos_fijos.filter((r) => r.id !== id);
  writeDB(db);
  return {};
};

// ─── GASTOS GENERALES ─────────────────────────────────────────────────────

export const getGastosGenerales = async (uid) => {
  const db = readDB();
  const data = db.gastos_generales
    .filter((r) => r.usuario_id === uid)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  return { data };
};

export const insertGastoGeneral = async (payload) => {
  const db = readDB();
  const row = { id: genId(), ...payload };
  db.gastos_generales.push(row);
  writeDB(db);
  return { data: row };
};

export const insertGastosGeneralesBatch = async (payloads) => {
  const db = readDB();
  const rows = payloads.map((p) => ({ id: genId(), ...p }));
  db.gastos_generales.push(...rows);
  writeDB(db);
  return { data: rows };
};

export const updateGastoGeneral = async (id, payload) => {
  const db = readDB();
  const idx = db.gastos_generales.findIndex((r) => r.id === id);
  if (idx === -1) return { data: null };
  db.gastos_generales[idx] = { ...db.gastos_generales[idx], ...payload };
  writeDB(db);
  return { data: db.gastos_generales[idx] };
};

export const deleteGastoGeneral = async (id) => {
  const db = readDB();
  db.gastos_generales = db.gastos_generales.filter((r) => r.id !== id);
  writeDB(db);
  return {};
};

export const deleteGastosGeneralesByIds = async (ids) => {
  const db = readDB();
  db.gastos_generales = db.gastos_generales.filter((r) => !ids.includes(r.id));
  writeDB(db);
  return {};
};

export const findGastosGeneralesByDescripcion = async (uid, descripcion) => {
  const db = readDB();
  const data = db.gastos_generales
    .filter((r) => r.usuario_id === uid && r.descripcion === descripcion)
    .map(({ id, fecha }) => ({ id, fecha }));
  return { data };
};

export const findFijosPrefixInRange = async (uid, startDate, endDate) => {
  const db = readDB();
  const data = db.gastos_generales
    .filter(
      (r) =>
        r.usuario_id === uid &&
        r.descripcion.startsWith('[Fijo]') &&
        r.fecha >= startDate &&
        r.fecha <= endDate
    )
    .map((r) => ({ descripcion: r.descripcion }));
  return { data };
};

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────

export const getCategorias = async (uid) => {
  const db = readDB();
  return { data: db.categorias.filter((r) => r.usuario_id === uid) };
};

export const insertCategoria = async (payload) => {
  const db = readDB();
  const row = { id: genId(), ...payload };
  db.categorias.push(row);
  writeDB(db);
  return { data: row };
};

export const updateCategoria = async (id, payload) => {
  const db = readDB();
  const idx = db.categorias.findIndex((r) => r.id === id);
  if (idx === -1) return { data: null };
  db.categorias[idx] = { ...db.categorias[idx], ...payload };
  writeDB(db);
  return { data: db.categorias[idx] };
};

export const deleteCategoria = async (id) => {
  const db = readDB();
  db.categorias = db.categorias.filter((r) => r.id !== id);
  writeDB(db);
  return {};
};

// ─── SUELDOS ──────────────────────────────────────────────────────────────

export const getSueldos = async (uid) => {
  const db = readDB();
  const data = db.sueldos
    .filter((r) => r.usuario_id === uid)
    .sort((a, b) => (b.fecha_pago || '').localeCompare(a.fecha_pago || ''));
  return { data };
};

export const insertSueldo = async (payload) => {
  const db = readDB();
  const row = { id: genId(), ...payload };
  db.sueldos.push(row);
  writeDB(db);
  return { data: row };
};

export const deleteSueldo = async (id) => {
  const db = readDB();
  db.sueldos = db.sueldos.filter((r) => r.id !== id);
  writeDB(db);
  return {};
};

// ─── RESPALDO COMPLETO (para exportar/importar JSON) ─────────────────────

export const exportAllData = () => readDB();

export const importAllData = (data) => {
  const merged = { ...emptyDB(), ...data };
  writeDB(merged);
};

export const clearAllData = () => writeDB(emptyDB());
