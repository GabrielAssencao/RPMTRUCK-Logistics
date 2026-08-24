import { useState, useEffect } from 'react';

export function useAdminData() {
  const [data, setData] = useState({ empresas: [], stats: null, loading: true, erro: '' });

  const fetchAll = async () => {
    try {
      const [empresasResponse, statsResponse] = await Promise.all([
        fetch('/api/empresas', { cache: 'no-store' }),
        fetch('/api/admin/stats', { cache: 'no-store' }),
      ]);
      const [empresasJson, statsJson] = await Promise.all([
        empresasResponse.json(),
        statsResponse.json(),
      ]);
      if (!empresasResponse.ok) throw new Error(empresasJson.erro || 'Falha ao carregar empresas.');
      if (!statsResponse.ok) throw new Error(statsJson.erro || 'Falha ao carregar indicadores.');
      setData({ empresas: Array.isArray(empresasJson) ? empresasJson : [], stats: statsJson, loading: false, erro: '' });
    } catch (e) {
      console.error(e);
      setData({ empresas: [], stats: null, loading: false, erro: e instanceof Error ? e.message : 'Falha ao carregar o painel.' });
    }
  };

  useEffect(() => { queueMicrotask(() => void fetchAll()); }, []);

  return { ...data, refresh: fetchAll };
}
