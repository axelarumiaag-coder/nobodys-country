/** Ruta d'un fitxer de /public tenint en compte la base de publicació (p. ex. './' en un subdirectori) */
export const asset = (path: string) => (/^(https?:|data:|blob:)/.test(path) ? path : `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`);
