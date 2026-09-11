// Type-only bridge for checking the Deno endpoint with the existing TypeScript toolchain.
declare const Deno: { env: { get(name:string):string|undefined } };
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler:(request:Request)=>Response|Promise<Response>):void;
}
