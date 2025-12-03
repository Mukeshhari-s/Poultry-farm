import { useCallback, useEffect, useState } from "react";
import { flockApi } from "../services/api";
import { decorateFlocksWithLabels } from "../utils/helpers";

export default function useFlocks() {
  const [flocks, setFlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchFlocks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await flockApi.list();
      setFlocks(decorateFlocksWithLabels(data));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to fetch flocks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlocks();
  }, [fetchFlocks]);

  return { flocks, loading, error, refreshFlocks: fetchFlocks };
}
