import { useEffect } from "react";

interface UsePhotoDetailKeyboardNavParams {
  canPrev: boolean;
  canNext: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export const usePhotoDetailKeyboardNav = ({
  canPrev,
  canNext,
  onPrev,
  onNext,
}: UsePhotoDetailKeyboardNavParams): void => {
  useEffect(() => {
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
  }, [canNext, canPrev, onNext, onPrev]);
};
