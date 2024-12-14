/** 
 * @file This file contains the main class for the web application.
 * @author Chek
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
    Color3,
    Viewport,
    SceneLoader,
    Mesh,
} from "@babylonjs/core";
import { SPLATFileLoader } from "@babylonjs/loaders";
import { FrustumVisualizer } from "./frustumVisualizer";
import { HMD } from "./hmd";
import {
    LAYER_SCENE,
    LAYER_UI,
    LAYER_HMD,
    LAYER_FRUSTUM,
    MAIN_CAM_POS,
    CAM_SPEED,
} from "./constants";

/**
 * The main class for the web application.
 */
export class App {
    // the BabylonJS engine
    private engine: Engine;

    // keep an id for the environment to load
    private envID = 0;
    private maxEnvID = 5;

    // keep a reference to the splat mesh to dispose later
    private splatMesh!: Mesh;

    // shadow generator for the scene
    private shadowGenerator!: ShadowGenerator;

    // make frustumVisualizerL and frustumVisualizerR global so that they can be toggled
    frustumVisualizerL: FrustumVisualizer | undefined;
    frustumVisualizerR: FrustumVisualizer | undefined;

    // PIP viewport parameters
    hmd!: HMD;
    pipViewPortWidth = 0.25;
    pipViewPortHeight!: number;
    pipViewPortX!: number;
    pipViewPortY!: number;

    /**
     * Constructor to create the App object with an engine.
     * @param engine The Babylon engine to use for the application.
     */
    constructor(engine: Engine) {
        this.engine = engine;

        // register the SPLATFileLoader plugin
        SceneLoader.RegisterPlugin(new SPLATFileLoader());
    }

    /**
     * Load lights and set shadow generators for the scene.
     */
    private loadLights(scene: Scene) {
        // create a hemispheric light
        const hemiLight = new HemisphericLight('env_hemiLight', new Vector3(0, 1, -1), scene);
        hemiLight.intensity = 0.6;

        // create a directional light that will cast shadows
        const dirLight = new DirectionalLight('dirLight', new Vector3(0, -1, -1), scene);
        dirLight.position = new Vector3(0, 1, 0);
        dirLight.intensity = 0.3;
        dirLight.shadowEnabled = true;
        dirLight.shadowMinZ = 0.01;
        dirLight.shadowMaxZ = 100;
        dirLight.diffuse = new Color3(0.3, 0.3, 0);

        // create a cone to represent the light
        const cone = MeshBuilder.CreateCylinder('env_cone', 
            {diameterTop: 0, diameterBottom: 0.05, height: 0.05}, scene);
        cone.position = dirLight.position;
        cone.rotation = new Vector3(Math.PI, 0, 0);
        const coneMat = new StandardMaterial('mat_coneMat', scene);
        //coneMat.diffuseColor.set(1, 1, 0);
        coneMat.emissiveColor.set(1, 1, 0);
        coneMat.alpha = 0.5;
        cone.material = coneMat;

        // Create shadow generator for the directional light
        this.shadowGenerator = new ShadowGenerator(1024, dirLight);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
    }

    /**
     * Construct an environment based on a pre-made model. 
     * @param scene The scene to load the environment into.
     * @param modelPath The path to the model to load.
     */
    private loadModel(scene: Scene, modelPath: string) {
        this.loadLights(scene);

        // Load the model
        SceneLoader.ImportMeshAsync(
            "env",
            modelPath,
            "",
            scene
        ).then((result) => {
            // Set the layer mask for the model
            result.meshes.forEach((mesh) => {
                mesh.layerMask = LAYER_SCENE;
                this.shadowGenerator.addShadowCaster(mesh);
            });
        });
    }

    /**
     * Construct an environment based on primitives
     */
    private loadPrimitives(scene: Scene) {
        this.loadLights(scene);

        // Create materials to reuse
        const mat1 = new StandardMaterial('mat_red', scene);
        mat1.diffuseColor.set(1, .3, .5);
        const mat2 = new StandardMaterial('mat_green', scene);
        mat2.diffuseColor.set(.3, 1, .5);
        const mat3 = new StandardMaterial('mat_blue', scene);
        mat3.diffuseColor.set(.3, .5, 1);
        const mat4 = new StandardMaterial('mat_yellow', scene);
        mat4.diffuseColor.set(1, 1, .5);

        // Create a scene with a box, torus knot, and ground plane
        const box = MeshBuilder.CreateBox('env_box', {size: .2}, scene);
        box.position.y = .2;
        box.position.x = -.2;
        box.rotation = new Vector3(Math.PI / 4, Math.PI / 4, 10);
        box.material = mat1;
        box.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(box);
        const tor = MeshBuilder.CreateTorusKnot('env_tor', 
            {radius: .1, tube: 0.038, radialSegments: 100, tubularSegments: 80}, scene);
        tor.position.y = .2;
        tor.position.x = .2;
        tor.material = mat3;
        tor.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(tor);
        const geodesic = MeshBuilder.CreateGeodesic('env_geo', {m: 1, n:1, size:.2}, scene);
        geodesic.position.y = 0.15;
        geodesic.position.z = .3;
        geodesic.material = mat4;
        geodesic.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(geodesic);
        const ground = CreateGround('env_ground', {width: 1, height: 1}, scene);
        ground.material = mat2;
        ground.receiveShadows = true;
        ground.position.y = -.1;

        // set the layer mask for the objects
        box.layerMask = LAYER_SCENE;
        tor.layerMask = LAYER_SCENE;
        geodesic.layerMask = LAYER_SCENE;
        ground.layerMask = LAYER_SCENE;
    }

    /**
     * Helper to load the correct environment based on the envID.
     * @param envID The environment ID to load.
     * @param scene The scene to load the environment into.
     */
    private loadEnvironment(envID: number, scene: Scene) {
        // envID 0 is the primitives environment
        // envID 1 to maxEnvID are the Gaussian Splat environments
        if (envID === 0) {
            this.loadPrimitives(scene);
        }
        else {
            this.loadGaussianSplat(envID, scene);
        }

    }

    /**
     * Helper to dispose of the necessary environmental objects in the scene.
     * - need to do a while loop to ensure all objects are disposed
     * - this is due to the fact that the scene.meshes array is modified when objects are disposed
     *   (or so this is what copilot says)
     * @param scene The scene to dispose of the objects in.
     */
    private disposeEnvObjects(scene: Scene) {
        // Repeat until all relevant objects are disposed
        let disposedAll = false;
        while (!disposedAll) {
            disposedAll = true;

            // Dispose of each mesh that starts with "env" or "splat"
            scene.meshes.slice().forEach((mesh) => {
                if (mesh.name.startsWith("env")) {
                    console.log(`Disposing of mesh: ${mesh.name}`);
                    mesh.dispose();
                    disposedAll = false; // Set flag to false if at least one item was disposed
                }
            });

            // Dispose of lights and their shadow generators
            scene.lights.slice().forEach((light) => {
                console.log(`Disposing of light: ${light.name}`);
                if (light instanceof DirectionalLight) {
                    light.getShadowGenerator()?.dispose();
                }
                light.dispose();
                disposedAll = false;
            });

            // Dispose of materials
            scene.materials.slice().forEach((mat) => {
                console.log(`Disposing of material: ${mat.name}`);
                mat.dispose();
                disposedAll = false;
            });

            // Dispose of splat mesh if it exists
            if (this.splatMesh && !this.splatMesh.isDisposed()) {
                console.log(`Disposing of mesh: ${this.splatMesh.name}`);
                this.splatMesh.dispose();
                disposedAll = false;
            }
        } 
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

        this.loadPrimitives(scene);

        // Create the HMD
        this.hmd = new HMD(scene);
        
        // Set the viewports for the HMD eye cameras
        const pipViewPortWidthPixels = this.pipViewPortWidth * this.engine.getRenderWidth();
        const pipViewPortHeightPixels = pipViewPortWidthPixels / this.hmd.aspectRatioEye;
        this.pipViewPortHeight = pipViewPortHeightPixels / this.engine.getRenderHeight();
        this.pipViewPortX = 1 - this.pipViewPortWidth * 2;
        this.pipViewPortY = 1 - this.pipViewPortHeight;
        this.hmd.camL.viewport = new Viewport(
            this.pipViewPortX,
            this.pipViewPortY,
            this.pipViewPortWidth,
            this.pipViewPortHeight
        ); // (x, y, width, height)
        this.hmd.camR.viewport = new Viewport(
            this.pipViewPortX + this.pipViewPortWidth,
            this.pipViewPortY,
            this.pipViewPortWidth,
            this.pipViewPortHeight
        ); // (x, y, width, height)
        
        // Create a user camera that can be controlled by wasd and mouse
        const camera = new FreeCamera(
            "camera",
            MAIN_CAM_POS,
            scene
        );
        camera.viewport = new Viewport(0, 0, 1, 1);
        camera.setTarget(Vector3.Zero());
        camera.attachControl(this.engine.getRenderingCanvas(), true);
        camera.keysUp = [87]; // W
        camera.keysDown = [83]; // S
        camera.keysLeft = [65]; // A
        camera.keysRight = [68]; // D
        camera.speed = CAM_SPEED; // slow down the camera movement
        camera.minZ = 0.01; // prevent camera from going to 0
        camera.maxZ = 100;

        // set camera layerMask to be able to render all
        camera.layerMask = LAYER_SCENE | LAYER_HMD | LAYER_FRUSTUM;

        // set a new camera to only render the GUI so that we can set it as the top layer to be interactible
        const guiCamera = new FreeCamera("guiCamera", Vector3.Zero(), scene);

        // Set the GUI camera to only render the UI layer
        guiCamera.layerMask = LAYER_UI;
        guiCamera.viewport = new Viewport(0, 0, 1, 1);

        // Ensure this secondary camera renders over the main camera
        scene.activeCameras = [camera, this.hmd.camL, this.hmd.camR, guiCamera]; // Render both cameras

        // get view and transform matrices from HMD
        let transformMat = this.hmd.transformMatrix;

        // Create a test view matrix that looks to the front
        //const viewMat = Matrix.LookAtLH(eyeL.position, Vector3.Zero(), Vector3.Up());

        // Create the frustum mesh for the eyes
        //const frustumLines = createFrustumLines(scene, projMat, viewMat, transformMat);
        this.frustumVisualizerL = new FrustumVisualizer(
            this.hmd.projMatL,
            this.hmd.viewMatrixL,
            transformMat,
            scene
        );
        this.frustumVisualizerR = new FrustumVisualizer(
            this.hmd.projMatR,
            this.hmd.viewMatrixR,
            transformMat,
            scene
        );

        // Create the scene animation by adding an observer just before rendering
        let elapsedSecs = 0.0;
        let animSpeed = .5;
        const newPos = this.hmd.pos.clone();
        scene.onBeforeRenderObservable.add(() => {
            // move the HMD in a sine wave oscillation to show changes in the frustum
            elapsedSecs += scene.getEngine().getDeltaTime() / 1000;
            newPos.x = Math.sin(elapsedSecs * 0.1) * animSpeed;
            this.hmd.updatePosition(newPos);

            // update the frustum mesh using updated view matrices
            this.frustumVisualizerL?.updateFrustumMesh(
                this.hmd.projMatL,
                this.hmd.viewMatrixL,
                transformMat
            );
            this.frustumVisualizerR?.updateFrustumMesh(
                this.hmd.projMatR,
                this.hmd.viewMatrixR,
                transformMat
            );
        });

        // Return the scene when it is ready
        return scene;
    }

    /**
     * Add a gaussian splat to the scene.
     * - the splat filenames are generated with generate-asset-filenames.sh
     * - fetch the splat filenames from assets/assets.json
     *
     * @param envID The environment ID to determine which splat to load.
     * @param scene The scene to add the Gaussian Splat to.
     */
    private async loadGaussianSplat(envID: number, scene: Scene) {
        // envID 0 is the primitives environment
        // envID 1 to maxEnvID are the Gaussian Splat environments
        const splatID = envID - 1;

        //const splats = [
            //"gs_Sqwakers_trimed.splat",
            //"gs_Skull.splat",
            //"gs_Plants.splat",
            //"gs_Fire_Pit.splat",
            //"Halo_Believe.splat",
        //];

        const response = await fetch("assets/assets.json");
        const splatFilenames = await response.json();
        this.maxEnvID = splatFilenames.length + 1;

        // create a hemispheric light
        const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.6;

        // Load the Gaussian Splat mesh locally
        SceneLoader.ImportMeshAsync(
            "splat",
            "assets/",
            splatFilenames[splatID],
            scene).then((result) => {
                // save the mesh to be able to dispose later
                this.splatMesh = result.meshes[0] as Mesh;
                this.splatMesh.scaling.setAll(0.3);

                // skull
                if (splatID === 1) {
                    this.splatMesh.rotation = new Vector3(0, 3.3*Math.PI, 0);
                }

                // fire pit
                else if (splatID === 2) {
                    this.splatMesh.position = new Vector3(0, 0.3, 0);
                    this.splatMesh.scaling.setAll(0.2);
                }

                // Set the layer mask for the Gaussian Splat
                this.splatMesh.layerMask = LAYER_SCENE;
            });
            //(meshes) => {
                //// Set the position of the Gaussian Splat
                //const mesh = meshes[0];
                //mesh.position = new Vector3(0, 1, 0);
                //mesh.layerMask = LAYER_SCENE;
            //}
        //);

        //SceneLoader.ImportMeshAsync(
            //"splat", 
            //"https://assets.babylonjs.com/splats/", 
            //"gs_Fire_Pit.splat", 
            //scene)
            //.then((result) => {
                //// Set the position of the Gaussian Splat
                //result.meshes[0].position = new Vector3(0, 0, 0);

                //// Set the layer mask for the Gaussian Splat
                //result.meshes[0].layerMask = LAYER_SCENE;
            //});
    }

    /**
     * Update HMD eye camera viewports when the window (browser) is resized.
     */
    updateHMDEyeCameraViewports() {
        // calculate the PIP viewport parameters
        const pipViewPortWidthPixels = this.pipViewPortWidth * this.engine.getRenderWidth();
        const pipViewPortHeightPixels = pipViewPortWidthPixels / this.hmd.aspectRatioEye;
        this.pipViewPortHeight = pipViewPortHeightPixels / this.engine.getRenderHeight();
        this.pipViewPortX = 1 - this.pipViewPortWidth * 2;
        this.pipViewPortY = 1 - this.pipViewPortHeight;

        // set the new viewport parameters
        this.hmd.camL.viewport.width = this.pipViewPortWidth;
        this.hmd.camL.viewport.height = this.pipViewPortHeight;
        this.hmd.camL.viewport.x = this.pipViewPortX;
        this.hmd.camL.viewport.y = this.pipViewPortY;
        this.hmd.camR.viewport.width = this.pipViewPortWidth;
        this.hmd.camR.viewport.height = this.pipViewPortHeight;
        this.hmd.camR.viewport.x = this.pipViewPortX + this.pipViewPortWidth;
        this.hmd.camR.viewport.y = this.pipViewPortY;
    }

    /**
     * Load the next environment.
     * @param isNext True if the next environment should be loaded, 
     *        false if the previous environment should be loaded.
     */
    loadNextEnvironment(isNext: boolean, scene: Scene) {
        // dispose of the current environment
        this.disposeEnvObjects(scene);

        // load the next environment
        if (isNext) {
            this.envID = (this.envID + 1) % this.maxEnvID;
        }
        else {
           this.envID = (this.envID - 1 + this.maxEnvID) % this.maxEnvID;
        }
        this.loadEnvironment(this.envID, scene);
    }

    /**
     * Move the camera by a given amount.
     * - this is called by UI joystick
     * @param dx The amount to move the camera in the x direction.
     * @param dz The amount to move the camera in the z direction.
     */
}
