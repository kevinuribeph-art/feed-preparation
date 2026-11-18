// Proyecto del servidor del portal (D-241): su URL y su clave «publishable», públicas por diseño (los permisos por fila y la
// función `firmar` deciden qué ve cada uno). En una copia servida en este Mac (127.0.0.1) nunca se usan: la copia de
// pruebas pone aquí los del proyecto de pruebas, así que nunca se mezclan.
window.PORTAL_CONFIG = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname)
  ? { url: "", publica: "" }
  : { url: "https://ipqeywhhuncpnqkvfxpn.supabase.co", publica: "sb_publishable_Gqu_MN2jOnjKLp9aYkTjyg_hqWBqZ2E" };
