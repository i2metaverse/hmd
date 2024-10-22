/**
 * @fileoverview The main application class for the project.
 * @author your instructors
 * @lastUpdated 2024-01-04
 */

import {
    ArcRotateCamera,
    Engine,
    HemisphericLight,
    Mesh,
    Scene,
    Vector3,
} from "@babylonjs/core";

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

        // Create the camera
        const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene);

        // Create the light
        const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);

        // Create a sphere
        const sphere = Mesh.CreateSphere('sphere', 16, 2, scene);

        // Set the camera target to the sphere
        camera.setTarget(sphere.position);

        // Set the camera position
        camera.setPosition(new Vector3(0, 0, 10));

        // Return the scene when it is ready
        return scene;
    }
}
