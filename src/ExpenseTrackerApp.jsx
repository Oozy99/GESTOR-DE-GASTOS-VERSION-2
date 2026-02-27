import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, TrendingUp, Calendar, DollarSign,
  PieChart, Edit2, X, Wallet, AlertCircle, RefreshCw, Power,
} from 'lucide-react';
import { supabase } from './supabase';

// ─── UTILIDADES DE FECHA COLOMBIA (UTC-5) ────────────────────────────────────
// Devuelve "YYYY-MM-DD" en hora Colombia sin importar la zona del navegador
const todayCol = () => {
  const now = new Date();
  // Colombia es UTC-5
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return col.toISOString().split('T')[0];
};

// Convierte "YYYY-MM-DD" a objeto Date interpretado como medianoche Colombia
const parseColDate = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  // Creamos la fecha como UTC para evitar desfases del navegador
  return new Date(Date.UTC(y, m - 1, d));
};

// Días restantes desde hoy Colombia hasta fecha "YYYY-MM-DD"
const daysRemainingCol = (dateStr) => {
  if (!dateStr) return 0;
  const today = parseColDate(todayCol());
  const target = parseColDate(dateStr);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

// Formatea "YYYY-MM-DD" a texto legible en Colombia
const formatDateCol = (str) => {
  if (!str) return '';
  const d = parseColDate(str);
  return d.toLocaleDateString('es-CO', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Nombre del mes en español a partir de "YYYY-MM-DD"
const monthNameFromDate = (str) => {
  if (!str) return '';
  const d = parseColDate(str);
  return d.toLocaleString('es', { timeZone: 'UTC', month: 'long' });
};

// Año a partir de "YYYY-MM-DD"
const yearFromDate = (str) => {
  if (!str) return new Date().getFullYear();
  return parseInt(str.split('-')[0]);
};

// Próxima renovación sumando días según frecuencia
const nextRenewal = (dateStr, frequency) => {
  const d = parseColDate(dateStr);
  if (frequency === 'quincenal') d.setUTCDate(d.getUTCDate() + 15);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().split('T')[0];
};
// ─────────────────────────────────────────────────────────────────────────────

const ExpenseTrackerApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('fijos');
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [salaries, setSalaries] = useState([]);

  const [newFixed, setNewFixed] = useState({
    servicio: '', categoria: '',
    precio: '', frecuencia: 'mensual', fechaRenovacion: '',
  });
  const [newGeneral, setNewGeneral] = useState({
    descripcion: '', precio: '',
    mes: monthNameFromDate(todayCol()),
    fecha: todayCol(),
    año: yearFromDate(todayCol()),
  });
  const [salary, setSalary] = useState({
    monto: '', frecuencia: 'mensual',
    fechaPago: todayCol(),
  });

  const [filterMonth, setFilterMonth] = useState('todos');
  const [filterYear, setFilterYear] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos'); // 'todos' | 'fijo' | 'manual'
  const [editingFixed, setEditingFixed] = useState(null);
  const [editingGeneral, setEditingGeneral] = useState(null);
  const [editingRefresco, setEditingRefresco] = useState(null); // { id, fecha }
  const [loading, setLoading] = useState(false);

  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  // ─── AUTH ───────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setAuthError('');
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setAuthError('Completa todos los campos'); return;
    }
    setAuthLoading(true);
    const { data, error } = await supabase
      .from('usuarios').select('id, username')
      .eq('username', loginForm.username.trim())
      .eq('password', loginForm.password).single();
    setAuthLoading(false);
    if (error || !data) { setAuthError('Usuario o contraseña incorrectos'); return; }
    setCurrentUser(data); setIsLoggedIn(true);
    setLoginForm({ username: '', password: '' });
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setCurrentUser(null);
    setFixedExpenses([]); setGeneralExpenses([]); setSalaries([]); setCategories([]);
  };

  // ─── CARGA DE DATOS ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    loadAllData();
  }, [isLoggedIn, currentUser]);

  const loadAllData = async () => {
    setLoading(true);
    const uid = currentUser.id;
    const [{ data: fixed }, { data: general }, { data: cats }, { data: sals }] = await Promise.all([
      supabase.from('gastos_fijos').select('*').eq('usuario_id', uid).order('fecha_renovacion', { ascending: true }),
      supabase.from('gastos_generales').select('*').eq('usuario_id', uid).order('fecha', { ascending: true }),
      supabase.from('categorias').select('*').eq('usuario_id', uid),
      supabase.from('sueldos').select('*').eq('usuario_id', uid).order('fecha_pago', { ascending: false }),
    ]);
    if (fixed) setFixedExpenses(fixed.map(mapFixed));
    if (general) setGeneralExpenses(general.map(mapGeneral));
    if (cats) {
      const mappedCats = cats.map(c => ({ id: c.id, nombre: c.nombre }));
      setCategories(mappedCats);
      if (mappedCats.length > 0) setNewFixed(prev => ({ ...prev, categoria: mappedCats[0].nombre }));
    }
    if (sals) setSalaries(sals.map(mapSalary));
    setLoading(false);
  };

  const mapFixed = (r) => ({
    id: r.id, servicio: r.servicio, categoria: r.categoria,
    precio: r.precio, frecuencia: r.frecuencia,
    fechaRenovacion: r.fecha_renovacion,
    proximaRenovacion: r.proxima_renovacion,
    costoQuincenal: r.costo_quincenal, costoMensual: r.costo_mensual,
    costoAnual: r.costo_anual,
    diasRestantes: daysRemainingCol(r.proxima_renovacion),
    activo: r.activo !== false, // default true si null
    ultimoRefresco: r.ultimo_refresco || null,
    fechaDesactivacion: r.fecha_desactivacion || null,
  });
  const mapGeneral = (r) => ({
    id: r.id, descripcion: r.descripcion, precio: r.precio,
    mes: r.mes, fecha: r.fecha, año: r.año,
  });
  const mapSalary = (r) => ({
    id: r.id, monto: r.monto, frecuencia: r.frecuencia, fechaPago: r.fecha_pago,
  });

  // ─── GASTOS FIJOS ───────────────────────────────────────────────────────────

  const addFixedExpense = async () => {
    if (!newFixed.servicio || !newFixed.precio || !newFixed.fechaRenovacion) return;
    const precio = parseFloat(newFixed.precio);
    const costoQuincenal = newFixed.frecuencia === 'quincenal' ? precio : 0;
    const costoMensual = newFixed.frecuencia === 'mensual' ? precio : precio * 2;
    const costoAnual = costoMensual * 12;
    const proximaRenovacion = nextRenewal(newFixed.fechaRenovacion, newFixed.frecuencia);
    const diasRestantes = daysRemainingCol(proximaRenovacion);

    const payload = {
      usuario_id: currentUser.id,
      servicio: newFixed.servicio, categoria: newFixed.categoria,
      precio, frecuencia: newFixed.frecuencia,
      fecha_renovacion: newFixed.fechaRenovacion,
      proxima_renovacion: proximaRenovacion,
      costo_quincenal: costoQuincenal, costo_mensual: costoMensual,
      costo_anual: costoAnual, dias_restantes: diasRestantes,
      activo: true,
    };

    if (editingFixed) {
      const { data } = await supabase.from('gastos_fijos').update(payload).eq('id', editingFixed.id).select().single();
      if (data) setFixedExpenses(prev => prev.map(e => e.id === data.id ? mapFixed(data) : e)
        .sort((a,b) => (parseColDate(a.fechaRenovacion) - parseColDate(b.fechaRenovacion))));
      setEditingFixed(null);
    } else {
      const { data } = await supabase.from('gastos_fijos').insert(payload).select().single();
      if (data) setFixedExpenses(prev => [...prev, mapFixed(data)]
        .sort((a,b) => (parseColDate(a.fechaRenovacion) - parseColDate(b.fechaRenovacion))));
    }
    setNewFixed({ servicio:'', categoria: categories[0]?.nombre || '', precio:'', frecuencia:'mensual', fechaRenovacion:'' });
  };

  const deleteFixedExpense = async (id) => {
    await supabase.from('gastos_fijos').delete().eq('id', id);
    setFixedExpenses(prev => prev.filter(e => e.id !== id));
  };

  const editFixedExpense = (expense) => {
    setEditingFixed(expense);
    setNewFixed({
      servicio: expense.servicio, categoria: expense.categoria,
      precio: expense.precio.toString(), frecuencia: expense.frecuencia,
      fechaRenovacion: expense.fechaRenovacion,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── NUEVO: Renovar fecha de un gasto fijo ───────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  // RENOVAR GASTO FIJO — lógica transversal completa
  //
  // Flujo:
  // 1. Actualiza gastos_fijos con la fecha real del pago (hoy o fecha manual)
  // 2. Determina a qué período de sueldo pertenece esa fecha de pago
  // 3. Elimina cualquier [Fijo] duplicado de este servicio en otros períodos
  // 4. Si ya existe un [Fijo] en el período correcto → lo actualiza
  //    Si no existe → lo crea en gastos_generales con la fecha del sueldo
  // ─────────────────────────────────────────────────────────────────────────────
  const renewFixedExpense = async (expense, fechaManual = null) => {
    const fechaPago = fechaManual || todayCol();
    const nuevaProxima = nextRenewal(fechaPago, expense.frecuencia);
    const nuevosDias = daysRemainingCol(nuevaProxima);

    // 1. Actualizar gastos_fijos
    const { data } = await supabase.from('gastos_fijos').update({
      fecha_renovacion: fechaPago,
      proxima_renovacion: nuevaProxima,
      dias_restantes: nuevosDias,
      ultimo_refresco: fechaPago,
    }).eq('id', expense.id).select().single();

    if (data) {
      setFixedExpenses(prev =>
        prev.map(e => e.id === data.id ? mapFixed(data) : e)
          .sort((a,b) => parseColDate(a.fechaRenovacion) - parseColDate(b.fechaRenovacion))
      );

      const descripcionFijo = `[Fijo] ${expense.servicio}`;
      const fechaPagoDate = parseColDate(fechaPago);

      // 2. Encontrar a qué período de sueldo pertenece la fecha del pago real
      const sueldoDestino = salaries.find(s => {
        const ini = parseColDate(s.fechaPago);
        const fin = parseColDate(s.fechaPago);
        if (s.frecuencia === 'quincenal') fin.setUTCDate(fin.getUTCDate() + 15);
        else fin.setUTCMonth(fin.getUTCMonth() + 1);
        return fechaPagoDate >= ini && fechaPagoDate <= fin;
      });

      // 3. Buscar todos los [Fijo] existentes de este servicio
      const { data: existentesFijo } = await supabase
        .from('gastos_generales')
        .select('id, fecha')
        .eq('usuario_id', currentUser.id)
        .eq('descripcion', descripcionFijo);

      const existentes = existentesFijo || [];

      if (sueldoDestino) {
        const iniDestino = parseColDate(sueldoDestino.fechaPago);
        const finDestino = parseColDate(sueldoDestino.fechaPago);
        if (sueldoDestino.frecuencia === 'quincenal') finDestino.setUTCDate(finDestino.getUTCDate() + 15);
        else finDestino.setUTCMonth(finDestino.getUTCMonth() + 1);

        // Separar: los que están en el período correcto vs los que están fuera
        const enPeriodoCorrecto = existentes.filter(e => {
          const d = parseColDate(e.fecha);
          return d >= iniDestino && d <= finDestino;
        });
        const fueraDePeriodo = existentes.filter(e => {
          const d = parseColDate(e.fecha);
          return !(d >= iniDestino && d <= finDestino);
        });

        // Eliminar todos los que están fuera del período correcto (duplicados históricos)
        if (fueraDePeriodo.length > 0) {
          const ids = fueraDePeriodo.map(e => e.id);
          await supabase.from('gastos_generales').delete().in('id', ids);
          setGeneralExpenses(prev => prev.filter(e => !ids.includes(e.id)));
        }

        if (enPeriodoCorrecto.length > 1) {
          // Más de uno en el período correcto → conservar el más reciente, eliminar resto
          const [conservar, ...eliminar] = enPeriodoCorrecto.sort((a,b) =>
            parseColDate(b.fecha) - parseColDate(a.fecha)
          );
          const idsEliminar = eliminar.map(e => e.id);
          await supabase.from('gastos_generales').delete().in('id', idsEliminar);
          setGeneralExpenses(prev => prev.filter(e => !idsEliminar.includes(e.id)));
        } else if (enPeriodoCorrecto.length === 0) {
          // No existe en el período correcto → crear
          const nuevo = {
            usuario_id: currentUser.id,
            descripcion: descripcionFijo,
            precio: expense.precio,
            mes: monthNameFromDate(sueldoDestino.fechaPago),
            fecha: sueldoDestino.fechaPago,
            año: yearFromDate(sueldoDestino.fechaPago),
          };
          const { data: insertado } = await supabase
            .from('gastos_generales').insert(nuevo).select().single();
          if (insertado) {
            setGeneralExpenses(prev =>
              [...prev, mapGeneral(insertado)]
                .sort((a,b) => parseColDate(a.fecha) - parseColDate(b.fecha))
            );
          }
        }
        // Si enPeriodoCorrecto.length === 1 → ya está correcto, no hacer nada

      } else {
        // No hay sueldo que cubra esa fecha → eliminar todos los [Fijo] sueltos
        // (el gasto quedará pendiente hasta que se registre el sueldo correspondiente)
        if (existentes.length > 0) {
          const ids = existentes.map(e => e.id);
          await supabase.from('gastos_generales').delete().in('id', ids);
          setGeneralExpenses(prev => prev.filter(e => !ids.includes(e.id)));
        }
      }
    }
  };

  // Guardar edición manual de ultimo_refresco con lógica transversal completa
  const saveRefrescoEdit = async () => {
    if (!editingRefresco) return;
    const expense = fixedExpenses.find(e => e.id === editingRefresco.id);
    if (!expense || !editingRefresco.fecha) return;
    await renewFixedExpense(expense, editingRefresco.fecha);
    setEditingRefresco(null);
  };



  // ─── NUEVO: Activar/Desactivar gasto fijo ────────────────────────────────
  const toggleFixedExpense = async (expense) => {
    const nuevoEstado = !expense.activo;
    const hoy = todayCol();
    let payload = { activo: nuevoEstado };
    if (!nuevoEstado) {
      // Al DESACTIVAR: guardamos la fecha y calculamos próxima desde hoy
      const proximaDesdeHoy = nextRenewal(hoy, expense.frecuencia);
      payload = { ...payload, fecha_desactivacion: hoy, proxima_renovacion: proximaDesdeHoy, dias_restantes: daysRemainingCol(proximaDesdeHoy) };
    } else {
      // Al REACTIVAR: limpiamos la fecha de desactivación
      payload = { ...payload, fecha_desactivacion: null };
    }
    const { data } = await supabase.from('gastos_fijos').update(payload).eq('id', expense.id).select().single();
    if (data) setFixedExpenses(prev => prev.map(e => e.id === data.id ? mapFixed(data) : e));
  };

  // ─── GASTOS GENERALES ───────────────────────────────────────────────────────

  const addGeneralExpense = async () => {
    if (!newGeneral.descripcion || !newGeneral.precio) return;
    const payload = {
      usuario_id: currentUser.id,
      descripcion: newGeneral.descripcion,
      precio: parseFloat(newGeneral.precio),
      mes: newGeneral.mes, fecha: newGeneral.fecha, año: newGeneral.año,
    };
    if (editingGeneral) {
      const { data } = await supabase.from('gastos_generales').update(payload).eq('id', editingGeneral.id).select().single();
      if (data) setGeneralExpenses(prev => prev.map(e => e.id === data.id ? mapGeneral(data) : e)
        .sort((a,b) => parseColDate(a.fecha) - parseColDate(b.fecha)));
      setEditingGeneral(null);
    } else {
      const { data } = await supabase.from('gastos_generales').insert(payload).select().single();
      if (data) setGeneralExpenses(prev => [...prev, mapGeneral(data)]
        .sort((a,b) => parseColDate(a.fecha) - parseColDate(b.fecha)));
    }
    const hoy = todayCol();
    setNewGeneral({ descripcion:'', precio:'', mes: monthNameFromDate(hoy), fecha: hoy, año: yearFromDate(hoy) });
  };

  const deleteGeneralExpense = async (id) => {
    await supabase.from('gastos_generales').delete().eq('id', id);
    setGeneralExpenses(prev => prev.filter(e => e.id !== id));
  };

  const editGeneralExpense = (expense) => {
    setEditingGeneral(expense);
    setNewGeneral({
      descripcion: expense.descripcion, precio: expense.precio.toString(),
      mes: expense.mes, fecha: expense.fecha,
      año: expense.año || yearFromDate(expense.fecha),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingFixed(null); setEditingGeneral(null);
    const hoy = todayCol();
    setNewFixed({ servicio:'', categoria: categories[0]?.nombre || '', precio:'', frecuencia:'mensual', fechaRenovacion:'' });
    setNewGeneral({ descripcion:'', precio:'', mes: monthNameFromDate(hoy), fecha: hoy, año: yearFromDate(hoy) });
  };

  // ─── CATEGORÍAS ─────────────────────────────────────────────────────────────

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    if (editingCategory) {
      const { data } = await supabase.from('categorias').update({ nombre: newCategory }).eq('id', editingCategory.id).select().single();
      if (data) setCategories(prev => prev.map(c => c.id === data.id ? { id: data.id, nombre: data.nombre } : c));
      setEditingCategory(null);
    } else {
      if (categories.find(c => c.nombre === newCategory)) { alert('Esta categoría ya existe'); return; }
      const { data } = await supabase.from('categorias').insert({ usuario_id: currentUser.id, nombre: newCategory }).select().single();
      if (data) setCategories(prev => [...prev, { id: data.id, nombre: data.nombre }]);
    }
    setNewCategory('');
  };

  const deleteCategory = async (cat) => {
    if (categories.length <= 1) { alert('Debes mantener al menos una categoría'); return; }
    const isUsed = fixedExpenses.some(e => e.categoria === cat.nombre);
    const msg = isUsed ? `La categoría "${cat.nombre}" está en uso. ¿Eliminar de todas formas?` : `¿Eliminar la categoría "${cat.nombre}"?`;
    if (!window.confirm(msg)) return;
    await supabase.from('categorias').delete().eq('id', cat.id);
    setCategories(prev => prev.filter(c => c.id !== cat.id));
    if (editingCategory?.id === cat.id) { setEditingCategory(null); setNewCategory(''); }
  };

  const editCategory = (cat) => { setEditingCategory(cat); setNewCategory(cat.nombre); };
  const cancelCategoryEdit = () => { setEditingCategory(null); setNewCategory(''); };

  // ─── SUELDOS ────────────────────────────────────────────────────────────────

  const addSalary = async () => {
    if (!salary.monto || !salary.fechaPago) return;

    // 1. Guardar el sueldo
    const { data } = await supabase.from('sueldos').insert({
      usuario_id: currentUser.id,
      monto: parseFloat(salary.monto),
      frecuencia: salary.frecuencia,
      fecha_pago: salary.fechaPago,
    }).select().single();

    if (data) {
      setSalaries(prev => [mapSalary(data), ...prev]
        .sort((a,b) => parseColDate(b.fechaPago) - parseColDate(a.fechaPago)));

      // 2. Rango del período según frecuencia del sueldo
      const startDate = parseColDate(salary.fechaPago);
      const endDate   = parseColDate(salary.fechaPago);
      if (salary.frecuencia === 'quincenal') endDate.setUTCDate(endDate.getUTCDate() + 15);
      else endDate.setUTCMonth(endDate.getUTCMonth() + 1);
      const endStr = endDate.toISOString().split('T')[0];

      // 3. Verificar duplicados: buscar [Fijo] de cualquier servicio ya en este período
      //    Se compara solo por descripción (no por fecha exacta) para cubrir pagos
      //    adelantados que ya fueron registrados con otra fecha dentro del período
      const { data: existentes } = await supabase
        .from('gastos_generales')
        .select('descripcion')
        .eq('usuario_id', currentUser.id)
        .like('descripcion', '[Fijo]%')
        .gte('fecha', salary.fechaPago)
        .lte('fecha', endStr);
      const serviciosRegistrados = new Set((existentes || []).map(e => e.descripcion));

      // 4. ─── REGLA CLAVE ───────────────────────────────────────────────────
      //    Solo se auto-asigna un gasto fijo si fue RENOVADO (ultimo_refresco)
      //    dentro del período del sueldo. Sin renovación = el usuario no pagó
      //    ese gasto en este período, por lo tanto NO se registra.
      // ────────────────────────────────────────────────────────────────────
      const gastosFijosAplicables = fixedExpenses.filter(gf => {
        if (!gf.activo) return false;

        // Sin renovación registrada → no aplica
        if (!gf.ultimoRefresco) return false;

        // El ultimo_refresco debe caer dentro del período del sueldo
        const fechaRefresco = parseColDate(gf.ultimoRefresco);
        if (fechaRefresco < startDate || fechaRefresco > endDate) return false;

        // Regla de frecuencia:
        // Quincenal → aplica a cualquier sueldo
        // Mensual   → aplica a sueldo mensual, o solo primera quincena si el sueldo es quincenal
        if (gf.frecuencia === 'quincenal') return true;
        if (gf.frecuencia === 'mensual' && salary.frecuencia === 'mensual') return true;
        if (gf.frecuencia === 'mensual' && salary.frecuencia === 'quincenal') {
          return startDate.getUTCDate() <= 15;
        }
        return false;
      });

      // 5. Insertar solo los servicios que no estén ya registrados en este período
      const nuevosGastos = gastosFijosAplicables
        .map(gf => ({
          usuario_id: currentUser.id,
          descripcion: `[Fijo] ${gf.servicio}`,
          precio: gf.precio,
          mes: monthNameFromDate(salary.fechaPago),
          fecha: salary.fechaPago,
          año: yearFromDate(salary.fechaPago),
        }))
        .filter(g => !serviciosRegistrados.has(g.descripcion));

      if (nuevosGastos.length > 0) {
        const { data: insertados } = await supabase
          .from('gastos_generales').insert(nuevosGastos).select();
        if (insertados) {
          setGeneralExpenses(prev =>
            [...prev, ...insertados.map(mapGeneral)]
              .sort((a,b) => parseColDate(a.fecha) - parseColDate(b.fecha))
          );
        }
      }
    }

    setSalary({ monto:'', frecuencia:'mensual', fechaPago: todayCol() });
  };

  const deleteSalary = async (id) => {
    if (!window.confirm('¿Eliminar este registro de sueldo?')) return;
    await supabase.from('sueldos').delete().eq('id', id);
    setSalaries(prev => prev.filter(s => s.id !== id));
  };

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0, maximumFractionDigits:0 }).format(amount);

  // Solo gastos fijos ACTIVOS cuentan para totales
  const getTotalFixedMensual = () => fixedExpenses.filter(e => e.activo).reduce((sum, e) => sum + e.costoMensual, 0);
  const getTotalFixedAnual = () => fixedExpenses.filter(e => e.activo).reduce((sum, e) => sum + e.costoAnual, 0);

  const handleMonthChange = (selectedMonth) => {
    const idx = MONTHS.indexOf(selectedMonth);
    const year = newGeneral.año || yearFromDate(todayCol());
    const d = new Date(Date.UTC(year, idx, 1));
    setNewGeneral({ ...newGeneral, mes: selectedMonth, fecha: d.toISOString().split('T')[0] });
  };

  const handleDateChange = (selectedDate) => {
    setNewGeneral({ ...newGeneral, fecha: selectedDate, mes: monthNameFromDate(selectedDate), año: yearFromDate(selectedDate) });
  };

  const getFilteredGeneralExpenses = () => generalExpenses.filter(e => {
    const year = yearFromDate(e.fecha).toString();
    const esFijo = e.descripcion.startsWith('[Fijo]');
    const pasaTipo = filterTipo === 'todos' || (filterTipo === 'fijo' && esFijo) || (filterTipo === 'manual' && !esFijo);
    return (filterMonth === 'todos' || e.mes === filterMonth) && (filterYear === 'todos' || year === filterYear) && pasaTipo;
  });

  const getAvailableYears = () => {
    const cur = new Date().getFullYear();
    return Array.from({ length: cur + 5 - 2020 + 1 }, (_, i) => 2020 + i).sort((a,b) => b-a);
  };

  const getFinancialHealth = () => {
    if (salaries.length === 0) return null;
    const sueldo = salaries[0].monto;
    const currentMonthName = monthNameFromDate(todayCol());
    const currentYear = yearFromDate(todayCol());
    const gastosGeneralesMes = generalExpenses
      .filter(e => e.mes === currentMonthName && (e.año === currentYear || yearFromDate(e.fecha) === currentYear))
      .reduce((sum, e) => sum + e.precio, 0);
    const gastosFijos = getTotalFixedMensual();
    const totalGastado = gastosFijos + gastosGeneralesMes;
    const disponible = sueldo - totalGastado;
    const porcentaje = sueldo > 0 ? (totalGastado / sueldo) * 100 : 0;
    let estado, color, bgColor, emoji, barColor;
    if (porcentaje <= 50) { estado='Excelente'; color='text-green-700'; bgColor='bg-green-50 border-green-200'; emoji='✅'; barColor='bg-green-500'; }
    else if (porcentaje <= 70) { estado='Buena'; color='text-blue-700'; bgColor='bg-blue-50 border-blue-200'; emoji='👍'; barColor='bg-blue-500'; }
    else if (porcentaje <= 90) { estado='Moderada'; color='text-yellow-700'; bgColor='bg-yellow-50 border-yellow-200'; emoji='⚠️'; barColor='bg-yellow-500'; }
    else { estado='Crítica'; color='text-red-700'; bgColor='bg-red-50 border-red-200'; emoji='🚨'; barColor='bg-red-500'; }
    return { sueldo, gastosFijos, gastosGeneralesMes, totalGastado, disponible, porcentaje, estado, color, bgColor, emoji, barColor, currentMonthName, currentYear };
  };

  const getGeneralByMonthGrouped = () => {
    const byMonth = {};
    generalExpenses.forEach(e => {
      const año = e.año || yearFromDate(e.fecha);
      const key = `${e.mes}__${año}`;
      if (!byMonth[key]) byMonth[key] = { mes: e.mes, año, total: 0, items: [] };
      byMonth[key].total += e.precio;
      byMonth[key].items.push(e);
    });
    return Object.values(byMonth).sort((a,b) => {
      if (b.año !== a.año) return b.año - a.año;
      return MONTHS.indexOf(b.mes) - MONTHS.indexOf(a.mes);
    });
  };

  // Gastos fijos del catálogo con fecha de renovación en el período (referencial / pendientes)
  const calculateFixedExpensesForPeriod = (salaryDate, frequency) => {
    const startDate = parseColDate(salaryDate);
    const endDate = parseColDate(salaryDate);
    if (frequency === 'quincenal') endDate.setUTCDate(endDate.getUTCDate() + 15);
    else endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    // Excluir los que ya fueron pagados (tienen [Fijo] en gastos_generales en este período)
    const yaPageados = new Set(
      generalExpenses
        .filter(e => {
          if (!e.descripcion.startsWith('[Fijo]')) return false;
          const d = parseColDate(e.fecha);
          return d >= startDate && d <= endDate;
        })
        .map(e => e.descripcion.replace('[Fijo] ', ''))
    );
    let total = 0; const details = [];
    fixedExpenses.filter(e => e.activo).forEach(e => {
      const d = parseColDate(e.fechaRenovacion);
      if (d >= startDate && d <= endDate && !yaPageados.has(e.servicio)) {
        total += e.precio;
        details.push({ servicio: e.servicio, monto: e.precio, fecha: e.fechaRenovacion });
      }
    });
    return { total, details };
  };

  // Gastos fijos que SÍ fueron renovados (pagados) — registrados con prefijo [Fijo]
  const calculateAutoFixedForPeriod = (salaryDate, frequency) => {
    const startDate = parseColDate(salaryDate);
    const endDate = parseColDate(salaryDate);
    if (frequency === 'quincenal') endDate.setUTCDate(endDate.getUTCDate() + 15);
    else endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    let total = 0; const details = [];
    generalExpenses.filter(e => e.descripcion.startsWith('[Fijo]')).forEach(e => {
      const d = parseColDate(e.fecha);
      if (d >= startDate && d <= endDate) {
        total += e.precio;
        details.push({ descripcion: e.descripcion.replace('[Fijo] ', ''), monto: e.precio, fecha: e.fecha });
      }
    });
    return { total, details };
  };

  // Solo gastos manuales del usuario (excluye los auto-asignados)
  const calculateGeneralExpensesForPeriod = (salaryDate, frequency) => {
    const startDate = parseColDate(salaryDate);
    const endDate = parseColDate(salaryDate);
    if (frequency === 'quincenal') endDate.setUTCDate(endDate.getUTCDate() + 15);
    else endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    let total = 0; const details = [];
    generalExpenses.filter(e => !e.descripcion.startsWith('[Fijo]')).forEach(e => {
      const d = parseColDate(e.fecha);
      if (d >= startDate && d <= endDate) { total += e.precio; details.push({ descripcion: e.descripcion, monto: e.precio, fecha: e.fecha }); }
    });
    return { total, details };
  };

  // ─── PANTALLA LOGIN ──────────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <DollarSign className="w-16 h-16 mx-auto text-indigo-600 mb-3" />
            <h1 className="text-3xl font-bold text-gray-800">Gestor de Gastos</h1>
            <p className="text-gray-500 text-sm mt-2">Ingresa con tus credenciales</p>
          </div>
          {authError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{authError}</div>}
          <div className="space-y-4">
            <input type="text" placeholder="Usuario" value={loginForm.username}
              onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              onKeyPress={e => e.key==='Enter' && handleLogin()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            <input type="password" placeholder="Contraseña" value={loginForm.password}
              onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              onKeyPress={e => e.key==='Enter' && handleLogin()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            <button onClick={handleLogin} disabled={authLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-60">
              {authLoading ? 'Verificando...' : 'Ingresar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Cargando tus datos...</p>
        </div>
      </div>
    );
  }

  const health = getFinancialHealth();
  const groupedGeneral = getGeneralByMonthGrouped();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-indigo-600 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gestor de Gastos</h1>
            <p className="text-indigo-200">Bienvenido, {currentUser.username}</p>
          </div>
          <button onClick={handleLogout} className="bg-white text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 font-semibold">
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex gap-3 flex-wrap">
          {[
            { key:'fijos', icon:<Calendar className="inline w-4 h-4 mr-1"/>, label:'Gastos Fijos' },
            { key:'generales', icon:<DollarSign className="inline w-4 h-4 mr-1"/>, label:'Gastos Generales' },
            { key:'seguimiento', icon:<TrendingUp className="inline w-4 h-4 mr-1"/>, label:'Seguimiento' },
            { key:'categorias', icon:<PieChart className="inline w-4 h-4 mr-1"/>, label:'Categorías' },
            { key:'sueldo', icon:<Wallet className="inline w-4 h-4 mr-1"/>, label:'Gestión de Sueldo' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${activeTab===t.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ─── GASTOS FIJOS ─── */}
        {activeTab === 'fijos' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{editingFixed ? 'Editar Gasto Fijo' : 'Agregar Gasto Fijo'}</h2>
              {editingFixed && (
                <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center justify-between">
                  <span>Editando: {editingFixed.servicio}</span>
                  <button onClick={cancelEdit}><X className="w-5 h-5"/></button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input type="text" placeholder="Servicio" value={newFixed.servicio}
                  onChange={e => setNewFixed({...newFixed, servicio: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                <select value={newFixed.categoria} onChange={e => setNewFixed({...newFixed, categoria: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  {categories.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
                <input type="text" placeholder="Precio (ej: 60000)" value={newFixed.precio}
                  onChange={e => setNewFixed({...newFixed, precio: e.target.value.replace(/[^\d]/g,'')})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                <select value={newFixed.frecuencia} onChange={e => setNewFixed({...newFixed, frecuencia: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha de renovación actual</label>
                  <input type="date" value={newFixed.fechaRenovacion}
                    onChange={e => setNewFixed({...newFixed, fechaRenovacion: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={addFixedExpense}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                  {editingFixed ? <><Edit2 className="w-4 h-4"/>Actualizar</> : <><Plus className="w-4 h-4"/>Agregar</>}
                </button>
                {editingFixed && <button onClick={cancelEdit} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg">Cancelar</button>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Gastos Fijos Registrados</h2>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Mensual (activos)</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(getTotalFixedMensual())}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Anual (activos)</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(getTotalFixedAnual())}</p>
                </div>
              </div>

              {/* Leyenda */}
              <div className="mb-3 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-blue-500"/>Renovar — avanza a la próxima fecha</span>
                <span className="flex items-center gap-1"><Power className="w-3 h-3 text-green-500"/>Activar/Desactivar registro</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      {['Estado','Servicio','Categoría','Precio','C. Quincenal','C. Mensual','C. Anual','Fecha Renov.','Últ. Refresco','Próx. Renov.','Días','Acciones'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fixedExpenses.map(e => (
                      <tr key={e.id} className={`border-b transition-colors ${e.activo ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60'}`}>
                        {/* Estado activo/inactivo */}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${e.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                              {e.activo ? 'Activo' : 'Inactivo'}
                            </span>
                            {!e.activo && e.fechaDesactivacion && (
                              <span className="text-xs text-gray-400">desde {formatDateCol(e.fechaDesactivacion)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium">{e.servicio}</td>
                        <td className="px-3 py-3">{e.categoria}</td>
                        <td className="px-3 py-3">{formatCurrency(e.precio)}</td>
                        <td className="px-3 py-3">{formatCurrency(e.costoQuincenal)}</td>
                        <td className="px-3 py-3 font-semibold">{formatCurrency(e.costoMensual)}</td>
                        <td className="px-3 py-3">{formatCurrency(e.costoAnual)}</td>
                        <td className="px-3 py-3 text-sm">{formatDateCol(e.fechaRenovacion)}</td>
                        <td className="px-3 py-3 text-sm">
                          {editingRefresco?.id === e.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={editingRefresco.fecha}
                                onChange={ev => setEditingRefresco({ ...editingRefresco, fecha: ev.target.value })}
                                className="text-xs border border-blue-300 rounded px-1 py-0.5 w-30 focus:ring-1 focus:ring-blue-400"
                              />
                              <button onClick={saveRefrescoEdit} title="Guardar" className="text-green-600 hover:text-green-800 font-bold px-1">✓</button>
                              <button onClick={() => setEditingRefresco(null)} title="Cancelar" className="text-gray-400 hover:text-gray-600 px-1">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group/ref">
                              {e.ultimoRefresco
                                ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{formatDateCol(e.ultimoRefresco)}</span>
                                : <span className="text-gray-300 text-xs">—</span>}
                              <button
                                onClick={() => setEditingRefresco({ id: e.id, fecha: e.ultimoRefresco || todayCol() })}
                                title="Editar fecha de último refresco"
                                className="opacity-0 group-hover/ref:opacity-100 transition-opacity text-blue-400 hover:text-blue-600 p-0.5">
                                <Edit2 className="w-3 h-3"/>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm">{formatDateCol(e.proximaRenovacion)}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${e.diasRestantes < 7 ? 'bg-red-100 text-red-700' : e.diasRestantes < 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {e.diasRestantes}d
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5 items-center">
                            {/* Renovar */}
                            <button
                              onClick={() => renewFixedExpense(e)}
                              disabled={!e.activo}
                              title="Renovar — avanza la fecha a la próxima"
                              className="text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded hover:bg-blue-50">
                              <RefreshCw className="w-4 h-4"/>
                            </button>
                            {/* Activar/Desactivar */}
                            <button
                              onClick={() => toggleFixedExpense(e)}
                              title={e.activo ? 'Desactivar registro' : 'Activar registro'}
                              className={`p-1 rounded ${e.activo ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                              <Power className="w-4 h-4"/>
                            </button>
                            {/* Editar */}
                            <button onClick={() => editFixedExpense(e)} className="text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50">
                              <Edit2 className="w-4 h-4"/>
                            </button>
                            {/* Eliminar */}
                            <button onClick={() => deleteFixedExpense(e.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fixedExpenses.length === 0 && <p className="text-center py-8 text-gray-400">No hay gastos fijos registrados</p>}
              </div>
            </div>
          </div>
        )}

        {/* ─── GASTOS GENERALES ─── */}
        {activeTab === 'generales' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{editingGeneral ? 'Editar Gasto General' : 'Agregar Gasto General'}</h2>
              {editingGeneral && (
                <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center justify-between">
                  <span>Editando: {editingGeneral.descripcion}</span>
                  <button onClick={cancelEdit}><X className="w-5 h-5"/></button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Descripción (ej: Farmacia)" value={newGeneral.descripcion}
                  onChange={e => setNewGeneral({...newGeneral, descripcion: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                <input type="text" placeholder="Precio (ej: 12700)" value={newGeneral.precio}
                  onChange={e => setNewGeneral({...newGeneral, precio: e.target.value.replace(/[^\d]/g,'')})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                <select value={newGeneral.mes} onChange={e => handleMonthChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  {MONTHS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                </select>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha del gasto (hora Colombia)</label>
                  <input type="date" value={newGeneral.fecha} onChange={e => handleDateChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={addGeneralExpense}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                  {editingGeneral ? <><Edit2 className="w-4 h-4"/>Actualizar</> : <><Plus className="w-4 h-4"/>Agregar</>}
                </button>
                {editingGeneral && <button onClick={cancelEdit} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg">Cancelar</button>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Gastos Generales Registrados</h2>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Mes</label>
                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="todos">Todos los meses</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Año</label>
                  <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="todos">Todos los años</option>
                    {getAvailableYears().map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Tipo</label>
                  <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="todos">Todos</option>
                    <option value="fijo">Solo Fijos Auto-asignados</option>
                    <option value="manual">Solo Manuales</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="bg-indigo-50 p-3 rounded-lg w-full">
                    <p className="text-sm text-gray-600">Total Filtrado</p>
                    <p className="text-xl font-bold text-indigo-600">
                      {formatCurrency(getFilteredGeneralExpenses().reduce((s,e) => s+e.precio, 0))}
                    </p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      {['Descripción','Precio','Mes','Fecha','Acciones'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredGeneralExpenses().map(e => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{e.descripcion}</td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(e.precio)}</td>
                        <td className="px-4 py-3 capitalize">{e.mes}</td>
                        <td className="px-4 py-3">{formatDateCol(e.fecha)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => editGeneralExpense(e)} className="text-blue-500 hover:text-blue-700"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={() => deleteGeneralExpense(e.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {getFilteredGeneralExpenses().length === 0 && <p className="text-center py-8 text-gray-400">No hay gastos para los filtros seleccionados</p>}
              </div>
            </div>
          </div>
        )}

        {/* ─── SEGUIMIENTO ─── */}
        {activeTab === 'seguimiento' && (
          <div className="space-y-6">
            {health ? (
              <div className={`rounded-xl shadow-md p-6 border ${health.bgColor}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{health.emoji}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      Salud Financiera — {health.currentMonthName.charAt(0).toUpperCase()+health.currentMonthName.slice(1)} {health.currentYear}
                    </h2>
                    <p className={`text-lg font-semibold ${health.color}`}>Estado: {health.estado}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Sueldo</p><p className="text-xl font-bold text-blue-600">{formatCurrency(health.sueldo)}</p></div>
                  <div className="bg-white rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Gastos Fijos</p><p className="text-xl font-bold text-red-600">{formatCurrency(health.gastosFijos)}</p></div>
                  <div className="bg-white rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Gastos del Mes</p><p className="text-xl font-bold text-orange-600">{formatCurrency(health.gastosGeneralesMes)}</p></div>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">{health.disponible >= 0 ? 'Disponible' : 'Déficit'}</p>
                    <p className={`text-xl font-bold ${health.disponible >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(health.disponible))}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-600">{formatCurrency(0)}</span>
                    <span className={`font-bold ${health.color}`}>{health.porcentaje.toFixed(1)}% utilizado</span>
                    <span className="text-gray-600">{formatCurrency(health.sueldo)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                    <div className={`h-full ${health.barColor} transition-all duration-700 flex items-center justify-end pr-3`}
                      style={{ width: `${Math.min(health.porcentaje, 100)}%` }}>
                      {health.porcentaje > 15 && <span className="text-white text-xs font-bold">{formatCurrency(health.totalGastado)}</span>}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Gastado: {formatCurrency(health.totalGastado)}</span>
                    <span>{health.disponible >= 0 ? `Disponible: ${formatCurrency(health.disponible)}` : `Déficit: ${formatCurrency(Math.abs(health.disponible))}`}</span>
                  </div>
                  {health.porcentaje > 100 && (
                    <div className="mt-3 bg-red-100 border border-red-300 rounded-lg p-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0"/>
                      <p className="text-sm text-red-700 font-semibold">¡Presupuesto excedido en {formatCurrency(Math.abs(health.disponible))}!</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                <p className="text-yellow-700 font-semibold">Registra un sueldo en "Gestión de Sueldo" para ver tu salud financiera.</p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Resumen Anual — Gastos Fijos</h2>
              <p className="text-gray-400 text-sm mb-4">Solo incluye registros activos</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Mensual</p>
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(getTotalFixedMensual())}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Proyección Anual (×12)</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(getTotalFixedAnual())}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Servicio</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Categoría</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold">Mensual</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold">Anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedExpenses.filter(e => e.activo).map(e => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{e.servicio}</td>
                        <td className="px-4 py-3">{e.categoria}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(e.costoMensual)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(e.costoAnual)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(getTotalFixedMensual())}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(getTotalFixedAnual())}</td>
                    </tr>
                  </tbody>
                </table>
                {fixedExpenses.filter(e => e.activo).length === 0 && <p className="text-center py-8 text-gray-400">No hay gastos fijos activos</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Gastos Generales por Mes</h2>
              {groupedGeneral.length === 0 ? (
                <p className="text-center py-8 text-gray-400">No hay gastos generales registrados</p>
              ) : (
                <div className="space-y-3">
                  {groupedGeneral.map(group => (
                    <details key={`${group.mes}-${group.año}`} className="group border border-gray-200 rounded-lg overflow-hidden">
                      <summary className="cursor-pointer bg-gray-50 hover:bg-gray-100 px-5 py-4 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-indigo-500"/>
                          <span className="font-semibold text-gray-800 capitalize">{group.mes} {group.año}</span>
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">{group.items.length} registros</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-indigo-600">{formatCurrency(group.total)}</span>
                          <span className="text-gray-400 group-open:rotate-180 transition-transform duration-200">▼</span>
                        </div>
                      </summary>
                      <div className="px-5 py-4 bg-white">
                        <table className="w-full">
                          <thead>
                            <tr className="text-xs text-gray-500 border-b">
                              <th className="text-left pb-2">Fecha</th>
                              <th className="text-left pb-2">Descripción</th>
                              <th className="text-right pb-2">Precio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(item => (
                              <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2 text-sm text-gray-500">{formatDateCol(item.fecha)}</td>
                                <td className="py-2 text-sm">{item.descripcion}</td>
                                <td className="py-2 text-sm font-semibold text-right">{formatCurrency(item.precio)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-indigo-50">
                              <td colSpan={2} className="py-2 px-1 font-bold text-gray-700">Total {group.mes.charAt(0).toUpperCase()+group.mes.slice(1)}</td>
                              <td className="py-2 font-bold text-indigo-700 text-right">{formatCurrency(group.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CATEGORÍAS ─── */}
        {activeTab === 'categorias' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Gestión de Categorías</h2>
            {editingCategory && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
                <span>Editando: <strong>{editingCategory.nombre}</strong></span>
                <button onClick={cancelCategoryEdit}><X className="w-5 h-5"/></button>
              </div>
            )}
            <div className="flex gap-3 mb-6">
              <input type="text" placeholder={editingCategory ? 'Nuevo nombre...' : 'Nueva categoría...'}
                value={newCategory} onChange={e => setNewCategory(e.target.value)}
                onKeyPress={e => e.key==='Enter' && addCategory()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              <button onClick={addCategory}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                {editingCategory ? <><Edit2 className="w-4 h-4"/>Actualizar</> : <><Plus className="w-4 h-4"/>Agregar</>}
              </button>
              {editingCategory && <button onClick={cancelCategoryEdit} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg">Cancelar</button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map(cat => (
                <div key={cat.id}
                  className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 px-4 py-3 rounded-lg flex items-center justify-between hover:shadow-md transition-all">
                  <span className="font-medium text-indigo-800">{cat.nombre}</span>
                  <div className="flex gap-2">
                    <button onClick={() => editCategory(cat)} className="bg-blue-500 text-white p-1.5 rounded hover:bg-blue-600"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => deleteCategory(cat)} className="bg-red-500 text-white p-1.5 rounded hover:bg-red-600"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
            {categories.length === 0 && <p className="text-center py-8 text-gray-400">No hay categorías. Agrega la primera arriba.</p>}
          </div>
        )}

        {/* ─── SUELDO ─── */}
        {activeTab === 'sueldo' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Registrar Nuevo Sueldo</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" placeholder="Monto (ej: 2500000)" value={salary.monto}
                  onChange={e => setSalary({...salary, monto: e.target.value.replace(/[^\d]/g,'')})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/>
                <select value={salary.frecuencia} onChange={e => setSalary({...salary, frecuencia: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha de pago (hora Colombia)</label>
                  <input type="date" value={salary.fechaPago} onChange={e => setSalary({...salary, fechaPago: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>
              <button onClick={addSalary}
                className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <Plus className="w-4 h-4"/>Registrar Sueldo
              </button>
            </div>

            {salaries.length > 0 ? (
              <div className="space-y-4">
                {salaries.map((s, index) => {
                  const fixedData   = calculateFixedExpensesForPeriod(s.fechaPago, s.frecuencia);   // pendientes (sin renovar)
                  const autoData    = calculateAutoFixedForPeriod(s.fechaPago, s.frecuencia);        // renovados (pagados)
                  const generalData = calculateGeneralExpensesForPeriod(s.fechaPago, s.frecuencia);  // manuales
                  // Total real = solo los fijos QUE SE PAGARON (renovados) + manuales
                  const totalGastos = autoData.total + generalData.total;
                  const saldo = s.monto - totalGastos;
                  const pct = s.monto > 0 ? (totalGastos / s.monto) * 100 : 0;

                  const endDate = parseColDate(s.fechaPago);
                  if (s.frecuencia === 'quincenal') endDate.setUTCDate(endDate.getUTCDate() + 15);
                  else endDate.setUTCMonth(endDate.getUTCMonth() + 1);

                  return (
                    <div key={s.id} className={`bg-white rounded-xl shadow-md p-6 border-2 ${index===0 ? 'border-indigo-400' : 'border-transparent'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold text-gray-800">Sueldo {s.frecuencia}</h3>
                            {index===0 && <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">Más Reciente</span>}
                          </div>
                          <p className="text-sm text-gray-500">{formatDateCol(s.fechaPago)}</p>
                          <p className="text-xs text-gray-400">Período: {formatDateCol(s.fechaPago)} → {formatDateCol(endDate.toISOString().split('T')[0])}</p>
                        </div>
                        <button onClick={() => deleteSalary(s.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-5 h-5"/></button>
                      </div>

                      {/* Tarjetas resumen — 5 bloques */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500">Sueldo</p>
                          <p className="text-xl font-bold text-blue-600">{formatCurrency(s.monto)}</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500">Fijos Pagados</p>
                          <p className="text-xl font-bold text-red-600">{formatCurrency(autoData.total)}</p>
                          <p className="text-xs text-gray-400">{autoData.details.length} renovados</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
                          <p className="text-xs text-gray-400">Fijos Sin Pagar</p>
                          <p className="text-xl font-bold text-gray-400">{formatCurrency(fixedData.total)}</p>
                          <p className="text-xs text-gray-400">{fixedData.details.length} pendientes</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500">Gastos Manuales</p>
                          <p className="text-xl font-bold text-orange-600">{formatCurrency(generalData.total)}</p>
                          <p className="text-xs text-gray-400">{((generalData.total/s.monto)*100).toFixed(1)}%</p>
                        </div>
                        <div className={`${saldo>=0?'bg-green-50':'bg-red-50'} p-3 rounded-lg`}>
                          <p className="text-xs text-gray-500">{saldo>=0?'Saldo':'Déficit'}</p>
                          <p className={`text-xl font-bold ${saldo>=0?'text-green-600':'text-red-600'}`}>{formatCurrency(Math.abs(saldo))}</p>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden mb-1">
                        <div className={`h-full transition-all duration-500 flex items-center justify-end pr-2 ${pct>100?'bg-red-500':pct>80?'bg-orange-500':pct>50?'bg-yellow-500':'bg-green-500'}`}
                          style={{width:`${Math.min(pct,100)}%`}}>
                          {pct>15 && <span className="text-xs font-bold text-white">{pct.toFixed(0)}%</span>}
                        </div>
                      </div>

                      {pct > 100 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 mt-2 mb-4">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0"/>
                          <p className="text-sm text-red-700 font-semibold">¡Presupuesto excedido en {formatCurrency(Math.abs(saldo))}!</p>
                        </div>
                      )}

                      {/* Distribución + gráfico circular */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 mb-4">
                        <div>
                          <h4 className="text-md font-semibold text-gray-800 mb-3">Distribución de Gastos</h4>
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Fijos Pagados (renovados)</span>
                                <span className="font-semibold">{formatCurrency(autoData.total)} <span className="text-xs text-gray-400">({((autoData.total/s.monto)*100).toFixed(1)}%)</span></span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-4">
                                <div className="bg-red-500 h-4 rounded-full transition-all" style={{width:`${Math.min((autoData.total/s.monto)*100,100)}%`}}></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Gastos Manuales</span>
                                <span className="font-semibold">{formatCurrency(generalData.total)} <span className="text-xs text-gray-400">({((generalData.total/s.monto)*100).toFixed(1)}%)</span></span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-4">
                                <div className="bg-orange-500 h-4 rounded-full transition-all" style={{width:`${Math.min((generalData.total/s.monto)*100,100)}%`}}></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">{saldo>=0?'Disponible':'Déficit'}</span>
                                <span className="font-semibold">{formatCurrency(Math.abs(saldo))} <span className="text-xs text-gray-400">({Math.abs((saldo/s.monto)*100).toFixed(1)}%)</span></span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-4">
                                <div className={`${saldo>=0?'bg-green-500':'bg-red-500'} h-4 rounded-full transition-all`} style={{width:`${Math.min(Math.abs((saldo/s.monto)*100),100)}%`}}></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Gráfico circular SVG */}
                        <div>
                          <h4 className="text-md font-semibold text-gray-800 mb-3">Resumen Visual</h4>
                          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-lg">
                            <div className="text-center mb-4">
                              <svg className="w-32 h-32 mx-auto" viewBox="0 0 36 36">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none" stroke="#E5E7EB" strokeWidth="3"/>
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke={pct>100?'#EF4444':pct>80?'#F97316':'#10B981'}
                                  strokeWidth="3"
                                  strokeDasharray={`${Math.min(pct,100)}, 100`}/>
                                <text x="18" y="20.35" fontSize="8" fontWeight="bold" fill="#374151" textAnchor="middle">
                                  {pct.toFixed(0)}%
                                </text>
                              </svg>
                            </div>
                            <p className="text-center text-sm text-gray-600 font-medium">
                              {pct>100?'⚠️ Presupuesto excedido':pct>80?'🔶 Cerca del límite':pct>50?'🟡 Mitad del presupuesto':'✅ Buen manejo'}
                            </p>
                            <div className="mt-4 pt-4 border-t border-indigo-200">
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Total Gastos:</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(totalGastos)}</span>
                              </div>
                              <div className="flex justify-between text-xs text-gray-600 mt-1">
                                <span>Total Sueldo:</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(s.monto)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detalles expandibles — 3 columnas */}
                      <details className="group">
                        <summary className="cursor-pointer bg-gray-50 hover:bg-gray-100 p-4 rounded-lg font-semibold text-gray-700 transition-colors flex justify-between items-center">
                          <span>📋 Ver Detalles de Gastos del Período</span>
                          <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">

                          {/* Col 1: Fijos renovados = pagados */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 text-red-500"/>Fijos Pagados ({autoData.details.length})
                            </h4>
                            {autoData.details.length > 0 ? (
                              <div className="bg-red-50 rounded-lg p-3 space-y-2 max-h-56 overflow-y-auto">
                                {autoData.details.map((d, idx) => (
                                  <div key={idx} className="flex justify-between items-start text-sm bg-white p-2 rounded">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-700">{d.descripcion}</p>
                                      <p className="text-xs text-gray-400">{formatDateCol(d.fecha)}</p>
                                    </div>
                                    <span className="font-semibold text-red-600 ml-2">{formatCurrency(d.monto)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold bg-white p-2 rounded border-t-2 border-red-200">
                                  <span className="text-gray-700">Subtotal:</span>
                                  <span className="text-red-600">{formatCurrency(autoData.total)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 rounded-lg p-3 text-center text-gray-400 text-sm">Ningún fijo renovado en este período</div>
                            )}
                          </div>

                          {/* Col 2: Fijos sin renovar = pendientes, no afectan el total */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400"/>Fijos Sin Pagar ({fixedData.details.length})
                            </h4>
                            {fixedData.details.length > 0 ? (
                              <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-56 overflow-y-auto border border-dashed border-gray-300">
                                {fixedData.details.map((d, idx) => (
                                  <div key={idx} className="flex justify-between items-start text-sm bg-white p-2 rounded">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-400">{d.servicio}</p>
                                      <p className="text-xs text-gray-400">{formatDateCol(d.fecha)}</p>
                                    </div>
                                    <span className="font-semibold text-gray-400 ml-2">{formatCurrency(d.monto)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold bg-white p-2 rounded border-t-2 border-gray-200">
                                  <span className="text-gray-500">Subtotal:</span>
                                  <span className="text-gray-400">{formatCurrency(fixedData.total)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 rounded-lg p-3 text-center text-gray-400 text-sm">Sin fijos pendientes</div>
                            )}
                          </div>

                          {/* Col 3: Gastos manuales */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-orange-500"/>Gastos Manuales ({generalData.details.length})
                            </h4>
                            {generalData.details.length > 0 ? (
                              <div className="bg-orange-50 rounded-lg p-3 space-y-2 max-h-56 overflow-y-auto">
                                {generalData.details.map((d, idx) => (
                                  <div key={idx} className="flex justify-between items-start text-sm bg-white p-2 rounded">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-700">{d.descripcion}</p>
                                      <p className="text-xs text-gray-400">{formatDateCol(d.fecha)}</p>
                                    </div>
                                    <span className="font-semibold text-orange-600 ml-2">{formatCurrency(d.monto)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold bg-white p-2 rounded border-t-2 border-orange-200">
                                  <span className="text-gray-700">Subtotal:</span>
                                  <span className="text-orange-600">{formatCurrency(generalData.total)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 rounded-lg p-3 text-center text-gray-400 text-sm">Sin gastos manuales en este período</div>
                            )}
                          </div>

                        </div>
                        <div className="mt-4 bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-800">Total Gastos del Período:</span>
                            <span className="text-2xl font-bold text-indigo-600">{formatCurrency(totalGastos)}</span>
                          </div>
                        </div>
                      </details>

                      {/* Comparación con período anterior */}
                      {index < salaries.length - 1 && (() => {
                        const prev = salaries[index + 1];
                        const prevAuto    = calculateAutoFixedForPeriod(prev.fechaPago, prev.frecuencia);
                        const prevGeneral = calculateGeneralExpensesForPeriod(prev.fechaPago, prev.frecuencia);
                        const prevTotal   = prevAuto.total + prevGeneral.total;
                        const diffGastos  = totalGastos - prevTotal;
                        const diffSueldo  = s.monto - prev.monto;
                        return (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="bg-blue-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-800 mb-3">📊 Comparación con Período Anterior</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-600 mb-1">Cambio en Sueldo</p>
                                  <p className={`font-bold text-lg ${diffSueldo>0?'text-green-600':diffSueldo<0?'text-red-600':'text-gray-600'}`}>
                                    {diffSueldo>0?'↗':diffSueldo<0?'↘':'→'} {formatCurrency(Math.abs(diffSueldo))}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 mb-1">Cambio en Gastos</p>
                                  <p className={`font-bold text-lg ${diffGastos<0?'text-green-600':diffGastos>0?'text-red-600':'text-gray-600'}`}>
                                    {diffGastos>0?'↗':diffGastos<0?'↘':'→'} {formatCurrency(Math.abs(diffGastos))}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 mb-1">Tendencia</p>
                                  <p className="font-bold text-lg text-indigo-600">
                                    {diffGastos<0&&diffSueldo>=0?'✅ Mejorando':diffGastos>0&&diffSueldo<=0?'⚠️ Empeorando':'➡️ Estable'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}

                {/* Estadísticas generales */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                  <h3 className="text-2xl font-bold mb-4">📈 Estadísticas Generales</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                      <p className="text-sm opacity-90 mb-1">Sueldo Promedio</p>
                      <p className="text-2xl font-bold">{formatCurrency(salaries.reduce((s,r)=>s+r.monto,0)/salaries.length)}</p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                      <p className="text-sm opacity-90 mb-1">Gasto Promedio</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(salaries.reduce((s,r)=>{
                          const f=calculateFixedExpensesForPeriod(r.fechaPago,r.frecuencia);
                          const g=calculateGeneralExpensesForPeriod(r.fechaPago,r.frecuencia);
                          return s+f.total+g.total;
                        },0)/salaries.length)}
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                      <p className="text-sm opacity-90 mb-1">Ahorro Promedio</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(salaries.reduce((s,r)=>{
                          const f=calculateFixedExpensesForPeriod(r.fechaPago,r.frecuencia);
                          const g=calculateGeneralExpensesForPeriod(r.fechaPago,r.frecuencia);
                          return s+(r.monto-f.total-g.total);
                        },0)/salaries.length)}
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                      <p className="text-sm opacity-90 mb-1">Períodos Registrados</p>
                      <p className="text-2xl font-bold">{salaries.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Wallet className="w-16 h-16 mx-auto text-gray-300 mb-4"/>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No hay sueldos registrados</h3>
                <p className="text-gray-500">Registra tu primer sueldo arriba para comenzar.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseTrackerApp;