/**
 * @fileoverview The main application class for the project.
 * @author your instructors
 * @lastUpdated 2024-01-04
 */

import {
    Engine,
    Scene,
    CreateSphere,
    HemisphericLight,
    Vector3,
    CreateGround,
    MeshBuilder,
    StandardMaterial,
    DirectionalLight,
    ShadowGenerator
} from "@babylonjs/core";
import {ArcRotateCamera} from "babylonjs";

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
     * Create a scene to illustrate how various hardware parameters in a VR HMD
     * affect the rendering of the virtual images for the left and right eyes.
     *
     * This will highlight the differences between the left and right eye images for:
     * - perspective projection frustums
     * - field of view (FOVs)
     * - lookat points
     *
     * The scene to be rendered will have a cuboid, a cone and a ground plane.
     *
     * The eyes will be represented by two spheres, one for each eye.
     *
     * The HMD will be a transparent box with a display screen and two lenses inside.
     * The parameters of the HMD will be adjustable through sliders:
     * - ipd: interpupillary distance
     * - d_eye: eye relief
     * - d_disp: distance from the display screen to the lenses
     * - w_disp: width of the display screen
     * - h_disp: height of the display screen
     * - f: focal length of the lenses
     *
     * Some resultant calculated parameters will be displayed:
     * - d_virt: distance from the lenses to the virtual image
     * - w_virt_l: width of the virtual image for the left eye
     * - h_virt_l: height of the virtual image for the left eye
     * - w_virt_r: width of the virtual image for the right eye
     * - h_virt_r: height of the virtual image for the right eye
     *
     * The left/right frustums will dynamically adjust based on the parameters of the HMD.
     *
     * There will be an overlay on the screen to show the left and right eye images.
     */
    async createScene() {
        // Create the BabylonJS scene
        const scene = new Scene(this.engine);
        scene.clearColor.set(0.15, 0.15, 0.15, 1);

        // Create a arcRotate camera and attach it to the canvas
        const camera = new ArcRotateCamera('camera', 5, 1, 15, new Vector3(0, 0, 0), scene);
        camera.attachControl(this.engine.getRenderingCanvas(), true);

        // create a hemispheric light
        const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.7;

        // create a directional light that will cast shadows
        const dirLight = new DirectionalLight('dirLight', new Vector3(0, -1, -1), scene);
        dirLight.position = new Vector3(0, 10, 10);
        dirLight.intensity = 0.8;
        dirLight.shadowEnabled = true;
        dirLight.shadowMinZ = 1;
        dirLight.shadowMaxZ = 100;

        // Create shadow generator for the directional light
        const shadowGenerator = new ShadowGenerator(1024, dirLight);

        // Create grid material with finer grid lines
        const mat1 = new StandardMaterial('red', scene);
        mat1.diffuseColor.set(1, 0, 0);
        const mat2 = new StandardMaterial('blue', scene);
        mat2.diffuseColor.set(0, 1, 0);
        const mat3 = new StandardMaterial('green', scene);
        mat3.diffuseColor.set(0, 0, 1);

        // Create a box with the grid material and shift it up and left, and rotate
        const box = MeshBuilder.CreateBox('box', {size: 2}, scene);
        box.position.y = 2;
        box.position.x = -2;
        box.rotation = new Vector3(Math.PI / 4, Math.PI / 4, 0);
        box.material = mat1;
        box.receiveShadows = true;
        shadowGenerator.addShadowCaster(box);

        // Create a cone with the grid material and shift it up and right
        const tor = MeshBuilder.CreateTorusKnot('tor', 
            {radius: 1, tube: 0.4, radialSegments: 100, tubularSegments: 20}, scene);
        tor.position.y = 2;
        tor.position.x = 2;
        tor.material = mat2;
        tor.receiveShadows = true;
        shadowGenerator.addShadowCaster(tor);

        // Create a ground plane with the grid material
        const ground = CreateGround('ground', {width: 10, height: 10}, scene);
        ground.material = mat3;
        ground.receiveShadows = true;

        // Return the scene when it is ready
        return scene;
    }
}
