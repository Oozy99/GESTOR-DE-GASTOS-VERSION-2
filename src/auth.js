// ─────────────────────────────────────────────────────────────────────────────
// auth.js — Login simple por nombre, sin backend ni contraseñas.
//
// Agrega aquí los nombres de las personas que pueden entrar a la app.
// No distingue mayúsculas/minúsculas ni espacios extra.
// Cada nombre tiene su propia información guardada por separado en el dispositivo.
// ─────────────────────────────────────────────────────────────────────────────

export const ALLOWED_USERS = [
  'admin', 
  // 👉 agrega aquí más nombres permitidos, por ejemplo:
  // 'juan',
  // 'maria',
];

export const authenticate = (username) => {
  const clean = (username || '').trim().toLowerCase();
  if (!clean) return null;
  const found = ALLOWED_USERS.find((u) => u.toLowerCase() === clean);
  if (!found) return null;
  // El "id" es el propio nombre en minúsculas: estable y único por dispositivo.
  return { id: found.toLowerCase(), username: found };
};
