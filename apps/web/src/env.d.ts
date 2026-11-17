declare module "cloudflare:workers" {
  export const env: import("./server/compile-proxy").CompilerEnvironment;
}

// Set explicitly by Vite so local dotenv files cannot override production.
declare const __PIKO_CONVEX_URL__: string;
declare const __PIKO_CONVEX_SITE_URL__: string;
