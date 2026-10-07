import { useState, useEffect, useCallback, useRef } from 'react';

export function useAdminData(ano) {
  const [data, setData] = useState({ empresas: [], stats: null, loading: true, erro: '' });
  const requestId = useRef(0);

  const fetchAll = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const [empresasResponse, statsResponse] = await Promise.all([
        fetch('/api/empresas', { cache: 'no-store' }),
        fetch(`/api/admin/stats${ano ? `?ano=${ano}` : ''}`, { cache: 'no-store' }),
      ]);
      const [empresasJson, statsJson] = await Promise.all([
        empresasResponse.json(),
        statsResponse.json(),
      ]);
      if (!empresasResponse.ok) throw new Error(empresasJson.erro || 'Falha ao carregar empresas.');
      if (!statsResponse.ok) throw new Error(statsJson.erro || 'Falha ao carregar indicadores.');
      if (currentRequest === requestId.current) setData({ empresas: Array.isArray(empresasJson) ? empresasJson : [], stats: statsJson, loading: false, erro: '' });
    } catch (e) {
      console.error(e);
      if (currentRequest === requestId.current) setData({ empresas: [], stats: null, loading: false, erro: e instanceof Error ? e.message : 'Falha ao carregar o painel.' });
    }
  }, [ano]);

  useEffect(() => { queueMicrotask(() => void fetchAll()); }, [fetchAll]);

  return { ...data, refresh: fetchAll };
}
