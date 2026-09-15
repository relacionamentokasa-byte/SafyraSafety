/**
 * clearStaleAuth.ts
 *
 * Remove qualquer sessão do Supabase que pertença a um projeto diferente
 * do projeto configurado em VITE_SUPABASE_URL.
 *
 * Este módulo é importado como efeito colateral no __root.tsx para garantir
 * que a limpeza ocorra ANTES de qualquer componente React ou cliente Supabase
 * ser inicializado.
 *
 * Não expõe nenhuma exportação — apenas executa a limpeza ao ser importado.
 */

(function clearStaleAuth() {
  if (typeof window === 'undefined') return;
  if (typeof localStorage === 'undefined') return;

  const supabaseUrl: string | undefined = import.meta.env['VITE_SUPABASE_URL'];
  if (!supabaseUrl) return;

  let currentRef: string;
  try {
    currentRef = new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    return;
  }

  const staleKeys = Object.keys(localStorage).filter(
    (key) =>
      key.startsWith('sb-') &&
      !key.startsWith(`sb-${currentRef}-`),
  );

  for (const key of staleKeys) {
    localStorage.removeItem(key);
    console.info(`[Auth] Sessão obsoleta removida: ${key}`);
  }
})();
