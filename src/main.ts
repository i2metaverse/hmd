/**
 * @file Main entry point for the application.
 * @author Chek
 * @lastUpdated 2 Nov 2024
 *
 * Here, we initialize the Babylon engine, create the scene (via App), create the UI and run the render loop.
 *
 * Software architecture:
 * ----------------------
 * The application simply uses a 2-layer architecture: App and UI.
 *
 * +-----------------+         +-----------------+
 * |       App       | ---o)---|        UI       |
 * +--------+--------+         +--------+--------+
 *
 * The App class is responsible for creating the scene and updating the scene based on the HMD.
 * - App owns the HMD and the FrustumVisualizer.
 * - App provides APIs for the UI to interact with the scene.
 *
 * The UI class is responsible for handling user interactions and use the App to update the scene.
 * - UI knows about the App but App does not know about the UI.
 */
import { Engine } from '@babylonjs/core';
import { App } from './app';
import {UI} from './ui';

// get the canvas element
const canvas = <HTMLCanvasElement>document.getElementById('renderCanvas');

// initialize babylon engine
const engine = new Engine(canvas, true);

// UI to be initialized after the scene is created
let ui: UI;

// create the scene and run the render loop
const app = new App(engine);
app.createScene().then(scene => {
    ui = new UI(app.hmd, scene, app);
    engine.runRenderLoop(() => {
        scene.render();
    })
});

// resize the canvas when the window is resized
window.addEventListener('resize', function () {
    engine.resize();
    app.updateHMDEyeCameraViewports();
    ui.updatePIPViewPortBorder(app)
});
