import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type Initializer<T> = () => T;

const isBrowser = (): boolean => typeof window !== "undefined";

const readFromLocalStorage = <T,>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return fallback;
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`Failed to read localStorage key "${key}":`, error);
    return fallback;
  }
};

const resolveInitialValue = <T,>(initialValue: T | Initializer<T>): T => {
  if (typeof initialValue === "function") {
    return (initialValue as Initializer<T>)();
  }
  return initialValue;
};

export const useLocalStorageState = <T,>(
  key: string,
  initialValue: T | Initializer<T>
): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    const fallback = resolveInitialValue(initialValue);
    return readFromLocalStorage<T>(key, fallback);
  });

  useEffect(() => {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to write localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
};
