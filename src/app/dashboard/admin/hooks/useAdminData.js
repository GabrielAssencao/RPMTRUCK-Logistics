import { useState, useEffect } from 'react';

export function useAdminData() {
  const [data, setData] = useState({ empresas: [], loading: true });

  const fetchAll = async () => {
    try {
      const res = await fetch('/api/empresas');
      const json = await res.json();
      setData({ empresas: json, loading: false });
    } catch (e) {
      console.error(e);
      setData({ empresas: [], loading: false });
    }
  };

  useEffect(() => { fetchAll(); }, []);

  return { ...data, refresh: fetchAll };
}