import { useCallback, useEffect, useState } from "react";
import { uploadService } from "@/services/uploadService";

interface UseUploadTokenStateResult {
  uploadToken: string;
  tokenError: string;
  isTokenConfigured: boolean;
  clearTokenError: () => void;
  setTokenError: (message: string) => void;
  updateUploadToken: (next: string) => void;
}

export const useUploadTokenState = (): UseUploadTokenStateResult => {
  const [uploadToken, setUploadToken] = useState<string>("");
  const [tokenError, setTokenErrorState] = useState<string>("");
  const [isTokenConfigured, setIsTokenConfigured] = useState(false);

  useEffect(() => {
    uploadService.getUploadToken().then((token) => {
      setUploadToken(token);
      setIsTokenConfigured(token.trim().length > 0);
    });
  }, []);

  const updateUploadToken = useCallback(async (next: string): Promise<void> => {
    setUploadToken(next);
    await uploadService.setUploadToken(next);
    setIsTokenConfigured(next.trim().length > 0);
    setTokenErrorState("");
  }, []);

  const setTokenError = useCallback((message: string): void => {
    setTokenErrorState(message);
  }, []);

  const clearTokenError = useCallback((): void => {
    setTokenErrorState("");
  }, []);

  return {
    uploadToken,
    tokenError,
    isTokenConfigured,
    clearTokenError,
    setTokenError,
    updateUploadToken,
  };
};
