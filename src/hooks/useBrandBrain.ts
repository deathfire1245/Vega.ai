import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BrandBrain, getBrandBrain, generateSystemPrompt } from '../services/brandBrainService';

export function useBrandBrain() {
  const { user } = useAuth();
  const [brandBrain, setBrandBrain] = useState<BrandBrain | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchBrand() {
      if (!user) {
        setBrandBrain(null);
        setSystemPrompt(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await getBrandBrain(user.uid);
        if (data) {
          setBrandBrain(data);
          setSystemPrompt(generateSystemPrompt(data));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch brand brain'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchBrand();
  }, [user]);

  return {
    brandBrain,
    systemPrompt,
    isLoading,
    error,
    refresh: async () => {
      if (user) {
        const data = await getBrandBrain(user.uid);
        if (data) {
          setBrandBrain(data);
          setSystemPrompt(generateSystemPrompt(data));
        }
      }
    }
  };
}
