declare module "cloudflare:workers" {
  export const env: import("./server/compile-proxy").CompilerEnvironment;
}
