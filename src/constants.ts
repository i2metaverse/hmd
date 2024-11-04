// Use layer masks to control what is rendered by the cameras
// - this is a bit mask, so we can combine the layers with bitwise OR
//   e.g., to render the Scene and UI, we set the layerMask to 0x1 | 0x2 = 0x3
// - 0x1: render the Scene
// - 0x2: render the UI
// - 0x3: render both the Scene and UI
// - 0x4: render the HMD
// - 0x5: render the Scene and HMD
// - 0x6: render the UI and HMD
// - 0x7: render the Scene, UI, and HMD
// - 0x8: render the Frustum

import {Vector3} from "@babylonjs/core";

// - 0xf: render everything
export const LAYER_SCENE = 0x1;
export const LAYER_HMD = 0x2;
export const LAYER_FRUSTUM = 0x4;
export const LAYER_UI = 0x8;

export const MAX_ENV_ID = 6;
export const MAIN_CAM_POS = new Vector3(1, 1, -1);
export const CAM_SPEED = 0.03;

export const MESH_EDGE_WIDTH = 0.1;

