import { useCallback, useEffect, useState } from "react";
import { uploadService } from "@/services/uploadService";

interface UseUploadTokenStateResult {
  uploadToken: string;
  tokenError: string;
  isTokenConfigured: boolean;
  clearTokenError: () => void;
  setTokenError: (message: string) => void;
  updateUploadToken: (next: string) => void;
  reloadToken: () => Promise<void>;
}

export const useUploadTokenState = (): UseUploadTokenStateResult => {
  const [uploadToken, setUploadToken] = useState<string>("");
  const [tokenError, setTokenErrorState] = useState<string>("");
  const [isTokenConfigured, setIsTokenConfigured] = useState(false);

  const loadToken = useCallback(async () => {
    const token = await uploadService.getUploadToken();
    setUploadToken(token);
    setIsTokenConfigured(token.trim().length > 0);
  }, []);

  useEffect(() => {
    void loadToken();
  }, [loadToken]);

  // 监听窗口焦点，当用户从设置页面返回时重新加载配置
  useEffect(() => {
    const handleFocus = () => {
      void loadToken();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadToken]);

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

  const reloadToken = useCallback(async (): Promise<void> => {
    await loadToken();
  }, [loadToken]);

  return {
    uploadToken,
    tokenError,
    isTokenConfigured,
    clearTokenError,
    setTokenError,
    updateUploadToken,
    reloadToken,
  };
};
