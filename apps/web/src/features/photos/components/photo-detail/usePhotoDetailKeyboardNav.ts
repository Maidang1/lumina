import { useEffect } from "react";

interface UsePhotoDetailKeyboardNavParams {
  canPrev: boolean;
  canNext: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
}

export const usePhotoDetailKeyboardNav = ({
  canPrev,
  canNext,
  onPrev,
  onNext,
  disabled = false,
}: UsePhotoDetailKeyboardNavParams): void => {
  useEffect(() => {
    if (disabled) {
      return;
    }

    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowLeft" && canPrev) {
        event.preventDefault();
        onPrev?.();
      }
      if (event.key === "ArrowRight" && canNext) {
        event.preventDefault();
        onNext?.();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [canNext, canPrev, disabled, onNext, onPrev]);
};
