/**
 * @file This file contains the main class for the web application.
 * @author your instructors
 * @lastUpdated 2024-01-04
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
 * - eyeRelief: eye relief
 * - distLens2Display: distance from the display screen to the lenses
 * - displayWidth: width of the display screen
 * - displayHeight: height of the display screen
 * - f: focal length of the lenses
 *
 * Some resultant calculated parameters will be displayed:
 * - distLens2Img: distance from the lenses to the virtual image
 * - imgWidthL: width of the virtual image for the left eye
 * - imgHeightL: height of the virtual image for the left eye
 * - imgWidthR: width of the virtual image for the right eye
 * - imgHeightR: height of the virtual image for the right eye
 *
 * The left/right frustums will dynamically adjust based on the parameters of the HMD.
 *
 * There will be an overlay on the screen to show the left and right eye images.
 */

const DEBUG = true;

// imports after the above so that I can easily jump to top and adjust the params
import {
    Engine,
    Scene,
    HemisphericLight,
    Vector3,
    CreateGround,
    MeshBuilder,
    StandardMaterial,
    DirectionalLight,
    ShadowGenerator,
    FreeCamera,
} from "@babylonjs/core";

import { FrustumVisualizer } from "./frustumVisualizer";
import { HMD } from "./hmd";

/**
 * The main class for the web application.
 */
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
     * Construct a mock environment.
     */
    private createEnvironment(scene: Scene) {
        // create a hemispheric light
        const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.6;

        // create a directional light that will cast shadows
        // TODO: create keys to move light
        const dirLight = new DirectionalLight('dirLight', new Vector3(0, -1, -1), scene);
        dirLight.position = new Vector3(0, 6, 0);
        dirLight.intensity = 0.3;
        dirLight.shadowEnabled = true;
        dirLight.shadowMinZ = 1;
        dirLight.shadowMaxZ = 100;

        // create a cone to represent the light
        const cone = MeshBuilder.CreateCylinder('cone', {diameterTop: 0, diameterBottom: 0.5, height: 0.5}, scene);
        cone.position = dirLight.position;
        cone.rotation = new Vector3(Math.PI, 0, 0);
        const coneMat = new StandardMaterial('coneMat', scene);
        coneMat.diffuseColor.set(1, 1, 0);
        coneMat.alpha = 0.8;
        cone.material = coneMat;

        // Create shadow generator for the directional light
        const shadowGenerator = new ShadowGenerator(1024, dirLight);
        shadowGenerator.useBlurExponentialShadowMap = true;

        // Create materials to reuse
        const mat1 = new StandardMaterial('red', scene);
        mat1.diffuseColor.set(1, .3, .5);
        const mat2 = new StandardMaterial('green', scene);
        mat2.diffuseColor.set(.5, 1, .6);
        const mat3 = new StandardMaterial('blue', scene);
        mat3.diffuseColor.set(.3, .5, 1);

        // Create a scene with a box, torus knot, and ground plane
        const box = MeshBuilder.CreateBox('box', {size: 2}, scene);
        box.position.y = 2;
        box.position.x = -2;
        box.rotation = new Vector3(Math.PI / 4, Math.PI / 4, 10);
        box.material = mat1;
        box.receiveShadows = true;
        shadowGenerator.addShadowCaster(box);
        const tor = MeshBuilder.CreateTorusKnot('tor', 
            {radius: 1, tube: 0.35, radialSegments: 100, tubularSegments: 20}, scene);
        tor.position.y = 2;
        tor.position.x = 2;
        tor.material = mat3;
        tor.receiveShadows = true;
        shadowGenerator.addShadowCaster(tor);
        const ground = CreateGround('ground', {width: 10, height: 10}, scene);
        ground.material = mat2;
        ground.receiveShadows = true;
        ground.position.y = -1;

    }

    /**
     * Create the scene.
     * @returns A promise that resolves when the application is done running.
     * @remarks This is the main entry point for the application.
     *
     */
    async createScene() {
        // Create the BabylonJS scene
        const scene = new Scene(this.engine);
        scene.clearColor.set(0.15, 0.15, 0.15, 1);

        // Create a user camera that can be controlled by wasd and mouse
        const camera = new FreeCamera('camera', new Vector3(10, 10, -10), scene);
        camera.setTarget(Vector3.Zero());
        camera.attachControl(this.engine.getRenderingCanvas(), true);
        camera.keysUp = [87]; // W
        camera.keysDown = [83]; // S
        camera.keysLeft = [65]; // A
        camera.keysRight = [68]; // D
        camera.speed = 0.3; // slow down the camera movement

        // create the scene environment
        this.createEnvironment(scene);

        // Create the HMD
        const hmd = new HMD(scene);

        // Get the projection matrix for each eye
        const projMatL = hmd.calcProjectionMatrix(true);
        const projMatR = hmd.calcProjectionMatrix(false);
        
        // get view and transform matrices from HMD
        let transformMat = hmd.transformMatrix;
        
        // Create a test view matrix that looks to the front
        //const viewMat = Matrix.LookAtLH(eyeL.position, Vector3.Zero(), Vector3.Up());

        // Create the frustum mesh for the eyes
        //const frustumLines = createFrustumLines(scene, projMat, viewMat, transformMat);
        const frustumVisualizerL = new FrustumVisualizer(projMatL, hmd.viewMatrixL, transformMat, scene);
        const frustumVisualizerR = new FrustumVisualizer(projMatR, hmd.viewMatrixR, transformMat, scene);

        // Create the scene animation
        let elapsedSecs = 0.0;
        let animSpeed = 2.0;
        const newPos = hmd.pos.clone();
        scene.onBeforeRenderObservable.add(() => {
            // move the HMD in a sine wave oscillation to show changes in the frustum
            elapsedSecs += scene.getEngine().getDeltaTime() / 1000;
            newPos.x = Math.sin(elapsedSecs * 0.1) * animSpeed;
            hmd.updatePosition(newPos);

            // update the frustum mesh using updated view matrices
            frustumVisualizerL.updateFrustumMesh(projMatL, hmd.viewMatrixL, transformMat);
            frustumVisualizerR.updateFrustumMesh(projMatR, hmd.viewMatrixR, transformMat);
        });

        // Return the scene when it is ready
        return scene;
    }
}
