/**
 * @fileoverview The main application class for the project.
 * @author your instructors
 * @lastUpdated 2024-01-04
 */

import {
    Engine,
    Scene,
    FreeCamera,
    CreateSphere,
    HemisphericLight,
    Vector3,
    CreateGround
} from "@babylonjs/core";
import {GridMaterial} from "@babylonjs/materials";

// App class
// - this is the main class for the web application
export class App {
    // the BabylonJS engine
    private engine: Engine;

    /**
     * Constructor to create the App object with an engine.
     * @param engine The Babylon engine to use for the application.
     */
    constructor(engine: Engine) {
        this.engine = engine;
    }

    /**
     * Create the scene.
     * @returns A promise that resolves when the application is done running.
     * @remarks This is the main entry point for the application.
     *
     * TODO the necessary code to create and return a scene with the following:
     *      1. Exactly 1 camera
     *      2. Exactly 1 light
     *      3. Exactly 1 primitive mesh (sphere, box, etc.)
     *      See BabylonJS documentation for more information:
     *      https://doc.babylonjs.com/
     */
    async createScene() {
        // Create the BabylonJS scene
        const scene = new Scene(this.engine);

        // Create a free camera
        const camera = new FreeCamera('camera', new Vector3(0, 5, -10), scene);
       
        // Attach the camera to the canvas
        camera.attachControl(this.engine.getRenderingCanvas(), true);

        // Create the light and add it to the scene
        const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        // Create grid material
        const material = new GridMaterial('grid', scene);

        // Create a sphere with the grid material and shift it up
        const sphere = CreateSphere('sphere', {segments: 16, diameter: 2}, scene);
        sphere.position.y = 2;
        sphere.material = material;

        // Set the camera target to the sphere
        camera.setTarget(sphere.position);

        // Create a ground plane with the grid material
        const ground = CreateGround('ground', {width: 6, height: 6}, scene);
        ground.material = material;

        // Return the scene when it is ready
        return scene;
    }
}
