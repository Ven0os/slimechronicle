/// <reference types="vite/client" />

declare module '*.html?raw' {
  const content: string;
  export default content;
}

declare const THREE: typeof import('three');
declare const Peer: typeof import('peerjs').default;
