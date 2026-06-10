import * as THREE from 'three';
import Peer from 'peerjs';

Object.assign(globalThis, { THREE, Peer });

declare global {
  interface Window {
    THREE: typeof THREE;
    Peer: typeof Peer;
    BuffBar: any;
  }
}

export { THREE, Peer };
