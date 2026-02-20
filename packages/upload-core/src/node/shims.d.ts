declare module "node:crypto" {
  interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(encoding: "hex"): string;
  }

  const crypto: {
    createHash(algorithm: string): Hash;
  };

  export default crypto;
}

declare const Buffer: {
  from(data: string | ArrayBuffer | Uint8Array | number[]): Uint8Array;
};
