import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, TrendingUp, Calendar, DollarSign,
  PieChart, Edit2, X, Wallet, AlertCircle,
} from 'lucide-react';
import { supabase } from './supabase';

const ExpenseTrackerApp = () => {
  const [currentUser, setCurrentUser] = useState(null); // { id, username }
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginMode, setLoginMode] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirm: '' });
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
    mes: new Date().toLocaleString('es', { month: 'long' }),
    fecha: new Date().toISOString().split('T')[0],
    año: new Date().getFullYear(),
  });
  const [salary, setSalary] = useState({
    monto: '', frecuencia: 'mensual',
    fechaPago: new Date().toISOString().split('T')[0],
  });

  const [filterMonth, setFilterMonth] = useState('todos');
  const [filterYear, setFilterYear] = useState('todos');
  const [editingFixed, setEditingFixed] = useState(null);
  const [editingGeneral, setEditingGeneral] = useState(null);
  const [loading, setLoading] = useState(false);

  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  // ─── AUTH ───────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setAuthError('');
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setAuthError('Completa todos los campos');
      return;
    }
    setAuthLoading(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, username')
      .eq('username', loginForm.username.trim())
      .eq('password', loginForm.password)
      .single();
    setAuthLoading(false);
    if (error || !data) {
      setAuthError('Usuario o contraseña incorrectos');
      return;
    }
    setCurrentUser(data);
    setIsLoggedIn(true);
    setLoginForm({ username: '', password: '' });
  };

  const handleRegister = async () => {
    setAuthError('');
    if (!registerForm.username.trim() || !registerForm.password.trim() || !registerForm.confirm.trim()) {
      setAuthError('Completa todos los campos');
      return;
    }
    if (registerForm.password.length < 4) {
      setAuthError('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      setAuthError('Las contraseñas no coinciden');
      return;
    }
    setAuthLoading(true);
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', registerForm.username.trim())
      .maybeSingle();
    if (existing) {
      setAuthLoading(false);
      setAuthError('Ese nombre de usuario ya está en uso');
      return;
    }
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ username: registerForm.username.trim(), password: registerForm.password })
      .select('id, username')
      .single();
    setAuthLoading(false);
    if (error || !data) {
      setAuthError('Error al registrar. Intenta de nuevo.');
      return;
    }
    const defaultCats = ['Transporte','Vivienda','Alimentación','Servicios','Entretenimiento','Salud','Educación','Otros'];
    await supabase.from('categorias').insert(defaultCats.map(n => ({ usuario_id: data.id, nombre: n })));
    setCurrentUser(data);
    setIsLoggedIn(true);
    setRegisterForm({ username: '', password: '', confirm: '' });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setFixedExpenses([]);
    setGeneralExpenses([]);
    setSalaries([]);
    setCategories([]);
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
    costoAnual: r.costo_anual, diasRestantes: r.dias_restantes,
  });
  const mapGeneral = (r) => ({
    id: r.id, descripcion: r.descripcion, precio: r.precio,
    mes: r.mes, fecha: r.fecha, año: r.año,
  });
  const mapSalary = (r) => ({
    id: r.id, monto: r.monto, frecuencia: r.frecuencia, fechaPago: r.fecha_pago,
  });

  // ─── GASTOS FIJOS ───────────────────────────────────────────────────────────

  const calculateDaysRemaining = (renewalDate) => {
    const today = new Date();
    const renewal = new Date(renewalDate);
    return Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
  };

  const calculateNextRenewal = (currentDate, frequency) => {
    const date = new Date(currentDate);
    if (frequency === 'quincenal') date.setDate(date.getDate() + 15);
    else date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
  };

  const addFixedExpense = async () => {
    if (!newFixed.servicio || !newFixed.precio || !newFixed.fechaRenovacion) return;
    const precio = parseFloat(newFixed.precio);
    const costoQuincenal = newFixed.frecuencia === 'quincenal' ? precio : 0;
    const costoMensual = newFixed.frecuencia === 'mensual' ? precio : precio * 2;
    const costoAnual = costoMensual * 12;
    const proximaRenovacion = calculateNextRenewal(newFixed.fechaRenovacion, newFixed.frecuencia);
    const diasRestantes = calculateDaysRemaining(proximaRenovacion);

    const payload = {
      usuario_id: currentUser.id,
      servicio: newFixed.servicio,
      categoria: newFixed.categoria,
      precio, frecuencia: newFixed.frecuencia,
      fecha_renovacion: newFixed.fechaRenovacion,
      proxima_renovacion: proximaRenovacion,
      costo_quincenal: costoQuincenal,
      costo_mensual: costoMensual,
      costo_anual: costoAnual,
      dias_restantes: diasRestantes,
    };

    if (editingFixed) {
      const { data } = await supabase.from('gastos_fijos').update(payload).eq('id', editingFixed.id).select().single();
      if (data) setFixedExpenses(prev => prev.map(e => e.id === data.id ? mapFixed(data) : e).sort((a,b) => new Date(a.fechaRenovacion)-new Date(b.fechaRenovacion)));
      setEditingFixed(null);
    } else {
      const { data } = await supabase.from('gastos_fijos').insert(payload).select().single();
      if (data) setFixedExpenses(prev => [...prev, mapFixed(data)].sort((a,b) => new Date(a.fechaRenovacion)-new Date(b.fechaRenovacion)));
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
      if (data) setGeneralExpenses(prev => prev.map(e => e.id === data.id ? mapGeneral(data) : e).sort((a,b) => new Date(a.fecha)-new Date(b.fecha)));
      setEditingGeneral(null);
    } else {
      const { data } = await supabase.from('gastos_generales').insert(payload).select().single();
      if (data) setGeneralExpenses(prev => [...prev, mapGeneral(data)].sort((a,b) => new Date(a.fecha)-new Date(b.fecha)));
    }
    const d = new Date();
    setNewGeneral({ descripcion:'', precio:'', mes: d.toLocaleString('es',{month:'long'}), fecha: d.toISOString().split('T')[0], año: d.getFullYear() });
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
      año: expense.año || new Date(expense.fecha).getFullYear(),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingFixed(null);
    setEditingGeneral(null);
    const d = new Date();
    setNewFixed({ servicio:'', categoria: categories[0]?.nombre || '', precio:'', frecuencia:'mensual', fechaRenovacion:'' });
    setNewGeneral({ descripcion:'', precio:'', mes: d.toLocaleString('es',{month:'long'}), fecha: d.toISOString().split('T')[0], año: d.getFullYear() });
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
    const { data } = await supabase.from('sueldos').insert({
      usuario_id: currentUser.id,
      monto: parseFloat(salary.monto),
      frecuencia: salary.frecuencia,
      fecha_pago: salary.fechaPago,
    }).select().single();
    if (data) setSalaries(prev => [mapSalary(data), ...prev].sort((a,b) => new Date(b.fechaPago)-new Date(a.fechaPago)));
    setSalary({ monto:'', frecuencia:'mensual', fechaPago: new Date().toISOString().split('T')[0] });
  };

  const deleteSalary = async (id) => {
    if (!window.confirm('¿Eliminar este registro de sueldo?')) return;
    await supabase.from('sueldos').delete().eq('id', id);
    setSalaries(prev => prev.filter(s => s.id !== id));
  };

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0, maximumFractionDigits:0 }).format(amount);

  const getTotalFixedMensual = () => fixedExpenses.reduce((sum, e) => sum + e.costoMensual, 0);
  const getTotalFixedAnual = () => fixedExpenses.reduce((sum, e) => sum + e.costoAnual, 0);

  const handleMonthChange = (selectedMonth) => {
    const idx = MONTHS.indexOf(selectedMonth);
    const year = newGeneral.año || new Date().getFullYear();
    const d = new Date(year, idx, 1);
    setNewGeneral({ ...newGeneral, mes: selectedMonth, fecha: d.toISOString().split('T')[0] });
  };

  const handleDateChange = (selectedDate) => {
    const date = new Date(selectedDate);
    setNewGeneral({ ...newGeneral, fecha: selectedDate, mes: date.toLocaleString('es',{month:'long'}), año: date.getFullYear() });
  };

  const getFilteredGeneralExpenses = () => generalExpenses.filter(e => {
    const year = new Date(e.fecha).getFullYear().toString();
    return (filterMonth === 'todos' || e.mes === filterMonth) && (filterYear === 'todos' || year === filterYear);
  });

  const getAvailableYears = () => {
    const cur = new Date().getFullYear();
    return Array.from({ length: cur + 5 - 2020 + 1 }, (_, i) => 2020 + i).sort((a,b) => b-a);
  };

  const getFinancialHealth = () => {
    if (salaries.length === 0) return null;
    const sueldo = salaries[0].monto;
    const now = new Date();
    const currentMonthName = now.toLocaleString('es', { month: 'long' });
    const currentYear = now.getFullYear();
    const gastosGeneralesMes = generalExpenses
      .filter(e => e.mes === currentMonthName && (e.año === currentYear || new Date(e.fecha).getFullYear() === currentYear))
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
      const año = e.año || new Date(e.fecha).getFullYear();
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

  const calculateFixedExpensesForPeriod = (salaryDate, frequency) => {
    const startDate = new Date(salaryDate);
    const endDate = new Date(salaryDate);
    if (frequency === 'quincenal') endDate.setDate(endDate.getDate() + 15);
    else endDate.setMonth(endDate.getMonth() + 1);
    let total = 0; const details = [];
    fixedExpenses.forEach(e => {
      const d = new Date(e.fechaRenovacion);
      if (d >= startDate && d <= endDate) { total += e.precio; details.push({ servicio: e.servicio, monto: e.precio, fecha: e.fechaRenovacion }); }
    });
    return { total, details };
  };

  const calculateGeneralExpensesForPeriod = (salaryDate, frequency) => {
    const startDate = new Date(salaryDate);
    const endDate = new Date(salaryDate);
    if (frequency === 'quincenal') endDate.setDate(endDate.getDate() + 15);
    else endDate.setMonth(endDate.getMonth() + 1);
    let total = 0; const details = [];
    generalExpenses.forEach(e => {
      const d = new Date(e.fecha);
      if (d >= startDate && d <= endDate) { total += e.precio; details.push({ descripcion: e.descripcion, monto: e.precio, fecha: e.fecha }); }
    });
    return { total, details };
  };

  // ─── PANTALLA DE LOGIN ──────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <DollarSign className="w-16 h-16 mx-auto text-indigo-600 mb-3" />
            <h1 className="text-3xl font-bold text-gray-800">Gestor de Gastos</h1>
          </div>
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            {[['login','Iniciar Sesión'],['register','Registrarse']].map(([m,label]) => (
              <button key={m} onClick={() => { setLoginMode(m); setAuthError(''); }}
                className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${loginMode===m ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {authError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{authError}</div>}
          {loginMode === 'login' ? (
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
          ) : (
            <div className="space-y-4">
              <input type="text" placeholder="Nombre de usuario" value={registerForm.username}
                onChange={e => setRegisterForm({...registerForm, username: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              <input type="password" placeholder="Contraseña (mínimo 4 caracteres)" value={registerForm.password}
                onChange={e => setRegisterForm({...registerForm, password: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              <input type="password" placeholder="Confirmar contraseña" value={registerForm.confirm}
                onChange={e => setRegisterForm({...registerForm, confirm: e.target.value})}
                onKeyPress={e => e.key==='Enter' && handleRegister()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              <button onClick={handleRegister} disabled={authLoading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-60">
                {authLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
              </button>
            </div>
          )}
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
                <input type="date" value={newFixed.fechaRenovacion}
                  onChange={e => setNewFixed({...newFixed, fechaRenovacion: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
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
                  <p className="text-sm text-gray-600">Total Mensual</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(getTotalFixedMensual())}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Anual</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(getTotalFixedAnual())}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      {['Servicio','Categoría','Precio','C. Quincenal','C. Mensual','C. Anual','Próx. Renov.','Días','Acciones'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fixedExpenses.map(e => (
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{e.servicio}</td>
                        <td className="px-4 py-3">{e.categoria}</td>
                        <td className="px-4 py-3">{formatCurrency(e.precio)}</td>
                        <td className="px-4 py-3">{formatCurrency(e.costoQuincenal)}</td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(e.costoMensual)}</td>
                        <td className="px-4 py-3">{formatCurrency(e.costoAnual)}</td>
                        <td className="px-4 py-3">{new Date(e.proximaRenovacion).toLocaleDateString('es-CO')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${e.diasRestantes < 7 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {e.diasRestantes}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => editFixedExpense(e)} className="text-blue-500 hover:text-blue-700"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={() => deleteFixedExpense(e.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
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
                <input type="date" value={newGeneral.fecha} onChange={e => handleDateChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
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
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <td className="px-4 py-3">{new Date(e.fecha).toLocaleDateString('es-CO')}</td>
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

            {/* Resumen anual — solo fijos */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Resumen Anual — Gastos Fijos</h2>
              <p className="text-gray-400 text-sm mb-4">Proyección basada en los servicios fijos actuales</p>
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
                    {fixedExpenses.map(e => (
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
                {fixedExpenses.length === 0 && <p className="text-center py-8 text-gray-400">No hay gastos fijos registrados</p>}
              </div>
            </div>

            {/* Gastos generales por mes */}
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
                                <td className="py-2 text-sm text-gray-500">{new Date(item.fecha).toLocaleDateString('es-CO')}</td>
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
                <input type="date" value={salary.fechaPago} onChange={e => setSalary({...salary, fechaPago: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <button onClick={addSalary}
                className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <Plus className="w-4 h-4"/>Registrar Sueldo
              </button>
            </div>

            {salaries.length > 0 ? (
              <div className="space-y-4">
                {salaries.map((s, index) => {
                  const fixedData = calculateFixedExpensesForPeriod(s.fechaPago, s.frecuencia);
                  const generalData = calculateGeneralExpensesForPeriod(s.fechaPago, s.frecuencia);
                  const totalGastos = fixedData.total + generalData.total;
                  const saldo = s.monto - totalGastos;
                  const pct = s.monto > 0 ? (totalGastos / s.monto) * 100 : 0;
                  return (
                    <div key={s.id} className={`bg-white rounded-xl shadow-md p-6 border-2 ${index===0 ? 'border-indigo-400' : 'border-transparent'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold text-gray-800">Sueldo {s.frecuencia}</h3>
                            {index===0 && <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">Más Reciente</span>}
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(s.fechaPago).toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
                          </p>
                        </div>
                        <button onClick={() => deleteSalary(s.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-5 h-5"/></button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Sueldo</p><p className="text-xl font-bold text-blue-600">{formatCurrency(s.monto)}</p></div>
                        <div className="bg-red-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Gastos Fijos</p><p className="text-xl font-bold text-red-600">{formatCurrency(fixedData.total)}</p></div>
                        <div className="bg-orange-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Gastos Generales</p><p className="text-xl font-bold text-orange-600">{formatCurrency(generalData.total)}</p></div>
                        <div className={`${saldo>=0?'bg-green-50':'bg-red-50'} p-3 rounded-lg`}>
                          <p className="text-xs text-gray-500">{saldo>=0?'Saldo':'Déficit'}</p>
                          <p className={`text-xl font-bold ${saldo>=0?'text-green-600':'text-red-600'}`}>{formatCurrency(Math.abs(saldo))}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden mb-1">
                        <div className={`h-full transition-all duration-500 flex items-center justify-end pr-2 ${pct>100?'bg-red-500':pct>80?'bg-orange-500':pct>50?'bg-yellow-500':'bg-green-500'}`}
                          style={{width:`${Math.min(pct,100)}%`}}>
                          {pct>15 && <span className="text-xs font-bold text-white">{pct.toFixed(0)}%</span>}
                        </div>
                      </div>
                      {pct > 100 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 mt-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0"/>
                          <p className="text-sm text-red-700 font-semibold">¡Presupuesto excedido en {formatCurrency(Math.abs(saldo))}!</p>
                        </div>
                      )}
                    </div>
                  );
                })}
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