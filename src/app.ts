/** @file This file contains the main class for the web application.
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
    Color3,
    Viewport,
    EventState,
} from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { FrustumVisualizer } from "./frustumVisualizer";
import { HMD } from "./hmd";
import { LAYER_SCENE, LAYER_UI, LAYER_HMD, LAYER_FRUSTUM } from "./constants";

/**
 * The main class for the web application.
 */
export class App {
    // the BabylonJS engine
    private engine: Engine;

    // make frustumVisualizerL and frustumVisualizerR global so that they can be toggled
    private frustumVisualizerL: FrustumVisualizer | undefined;
    private frustumVisualizerR: FrustumVisualizer | undefined;

    // PIP viewport parameters
    private hmd!: HMD;
    private pipViewPortWidth = 0.25;
    private pipViewPortHeight!: number;
    private pipViewPortX!: number;
    private pipViewPortY!: number;

    // set PIP viewport GUI to be global as we need to update it when the window is resized
    private pipViewPortBorderL!: GUI.Rectangle;
    private pipViewPortBorderR!: GUI.Rectangle;

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
        const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, -1), scene);
        hemiLight.intensity = 0.6;

        // create a directional light that will cast shadows
        // TODO: create keys to move light
        const dirLight = new DirectionalLight('dirLight', new Vector3(0, -1, -1), scene);
        dirLight.position = new Vector3(0, 10, 0);
        dirLight.intensity = 0.3;
        dirLight.shadowEnabled = true;
        dirLight.shadowMinZ = 1;
        dirLight.shadowMaxZ = 100;
        dirLight.diffuse = new Color3(0.3, 0.3, 0);

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
        mat2.diffuseColor.set(.3, 1, .5);
        const mat3 = new StandardMaterial('blue', scene);
        mat3.diffuseColor.set(.3, .5, 1);
        const mat4 = new StandardMaterial('yellow', scene);
        mat4.diffuseColor.set(1, 1, .5);

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
        const geodesic = MeshBuilder.CreateGeodesic('aaa', {m: 1, n:1, size:2}, scene);
        geodesic.position.y = 1.5;
        geodesic.position.z = 3;
        geodesic.material = mat4;
        geodesic.receiveShadows = true;
        shadowGenerator.addShadowCaster(geodesic);
        const ground = CreateGround('ground', {width: 10, height: 10}, scene);
        ground.material = mat2;
        ground.receiveShadows = true;
        ground.position.y = -1;

        // set the layer mask for the objects
        box.layerMask = LAYER_SCENE;
        tor.layerMask = LAYER_SCENE;
        geodesic.layerMask = LAYER_SCENE;
        ground.layerMask = LAYER_SCENE;
    }

    /**
     * Add UI controls to the scene.
     * - add a slider to change the eyeRelief in the HMD.
     */
    private addUI(hmd: HMD) {
        // create a GUI
        const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');

        // set layerMask so that we prevent it from being rendered by the HMD cameras
        if (advancedTexture.layer) {
            advancedTexture.layer.layerMask = LAYER_UI;
        }

        // create a stack panel to hold the controls
        const userPanel = new GUI.StackPanel();
        userPanel.width = '220px';
        userPanel.fontSize = '14px';
        userPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        userPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        advancedTexture.addControl(userPanel);

        // padding
        userPanel.paddingRight = '20px';
        userPanel.paddingBottom = '20px';

        // create a stack of sliders, with the label and value on the left col, 
        // and the slider on the right col, params to change include:
        const sliders = hmd.sliderParams;
        for (const key in sliders) {
            if (sliders.hasOwnProperty(key)) {
                const slider = new GUI.Slider();
                const typedKey = key as keyof typeof sliders;
                slider.minimum = sliders[typedKey].min;
                slider.maximum = sliders[typedKey].max;
                slider.value = hmd[typedKey];
                slider.height = '20px';
                slider.width = '200px';
                slider.color = 'red';
                slider.background = 'white';
                slider.onValueChangedObservable.add((value) => {
                    hmd.setParam(key, value)
                });

                const textBlock = new GUI.TextBlock();
                textBlock.text = `${key}: ${slider.value.toFixed(2)}`;
                textBlock.height = '20px';
                textBlock.color = 'white';
                textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

                // update the text block when the slider changes
                slider.onValueChangedObservable.add(() => {
                    textBlock.text = `${key}: ${slider.value.toFixed(2)}`;
                });

                // add the text block and slider to the stack panel
                userPanel.addControl(textBlock);
                userPanel.addControl(slider);
            }
        }

        // create a list of text blocks to show all the HMD params and calculated values
        // - make them tiny and packed so they don't take up much space
        // - place them on the left of the screen
        const statsPanel = new GUI.StackPanel();
        statsPanel.width = '220px';
        statsPanel.fontSize = '12px';
        statsPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        statsPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        advancedTexture.addControl(statsPanel);

        // reduce the line space between the text blocks
        statsPanel.paddingBottom = '20px';
        statsPanel.paddingLeft = '20px';

        // create a text block for each HMD param
        // - show the param name and value
        // - dynamically update the value when the param changes
        // TODO: the updating is very inefficient, but it's fine for now
        //let displayParams = hmd.displayParams;
        //for (const key in displayParams) {
            //if (displayParams.hasOwnProperty(key)) {
                //const textBlock = new GUI.TextBlock();
                //const typedKey = key as keyof typeof displayParams;
                //const value = displayParams[typedKey];

                //// Ensure the value is numeric before using .toFixed(2)
                //if (typeof value === 'number') {
                    //textBlock.text = `${key}: ${value.toFixed(2)}`;
                //} else {
                    //textBlock.text = `${key}: ${value}`;
                //}

                //textBlock.height = '12px';
                //textBlock.color = 'white';
                //textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                //statsPanel.addControl(textBlock);

                //// update the text block when the param changes
                //hmd.onValuesUpdatedObservable.add(() => {
                    //// fetch the latest value
                    //displayParams = hmd.displayParams;

                    //// Ensure the value is numeric before using .toFixed(2)
                    //const value = displayParams[typedKey];
                    //if (typeof value === 'number') {
                        //textBlock.text = `${key}: ${value.toFixed(2)}`;
                    //} else {
                        //textBlock.text = `${key}: ${value}`;
                    //}
                //});
            //}
        //}

        let displayCalculatedVals = hmd.displayCalculatedVals;
        for (const key in displayCalculatedVals) {
            if (displayCalculatedVals.hasOwnProperty(key)) {
                const textBlock = new GUI.TextBlock();
                const typedKey = key as keyof typeof displayCalculatedVals;
                const value = displayCalculatedVals[typedKey];

                // Ensure the value is numeric before using .toFixed(2)
                if (typeof value === 'number') {
                    textBlock.text = `${key}: ${value.toFixed(2)}`;
                } else {
                    textBlock.text = `${key}: ${value}`;
                }

                textBlock.height = '12px';
                textBlock.color = 'yellow';
                textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                statsPanel.addControl(textBlock);

                // update the text block when the param changes
                hmd.onValuesUpdatedObservable.add(() => {
                    // fetch the latest value
                    displayCalculatedVals = hmd.displayCalculatedVals;

                    // Ensure the value is numeric before using .toFixed(2)
                    const value = displayCalculatedVals[typedKey];
                    if (typeof value === 'number') {
                        textBlock.text = `${key}: ${value.toFixed(2)}`;
                    } else {
                        textBlock.text = `${key}: ${value}`;
                    }
                });
            }

        }

        // Create a horizontal StackPanel to hold both buttons side by side
        const buttonPanel = new GUI.StackPanel();
        buttonPanel.isVertical = false; // Set to horizontal layout
        buttonPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

        // Add the left and right frustum toggle buttons to the buttonPanel
        const toggleFrustumL = this.createToggleButton('Frustum L', '#8B0000', () => {
            this.frustumVisualizerL?.toggleVisibility();
        });
        const toggleFrustumR = this.createToggleButton('Frustum R', '#00008B', () => {
            this.frustumVisualizerR?.toggleVisibility();
        });

        // Add frustum togglers
        buttonPanel.addControl(toggleFrustumL);
        buttonPanel.addControl(toggleFrustumR);

        // Add the buttonPanel to the userPanel
        advancedTexture.addControl(buttonPanel)

        // set border around PIP viewports using UI rectangles
        this.pipViewPortBorderL = new GUI.Rectangle();        
        this.pipViewPortBorderL.thickness = 5;
        this.pipViewPortBorderL.color = 'pink';
        this.pipViewPortBorderL.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.pipViewPortBorderL.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.pipViewPortBorderR = new GUI.Rectangle();
        this.pipViewPortBorderR.thickness = 5;
        this.pipViewPortBorderR.color = 'pink';
        this.pipViewPortBorderR.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.pipViewPortBorderR.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.pipViewPortBorderL.cornerRadius = 3;
        this.pipViewPortBorderR.cornerRadius = 3;
        advancedTexture.addControl(this.pipViewPortBorderL);
        advancedTexture.addControl(this.pipViewPortBorderR);
        this.updatePIPViewPortBorder();

        // add some textual instructions on top left to use WASD and mouse to move the camera
        const instructions = new GUI.TextBlock();
        instructions.text = 'WASD and mouse to move camera';
        instructions.color = 'white';
        instructions.fontSize = '14px';
        instructions.top = '200px';
        instructions.left = '20px';
        instructions.width = '235px';
        instructions.height = '30px';
        instructions.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        instructions.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;

        // add a background to the instructions
        const instructionsBackground = new GUI.Rectangle();
        instructionsBackground.background = 'red'; // dark red
        instructionsBackground.alpha = 0.1;
        instructionsBackground.thickness = 2;
        instructionsBackground.width = instructions.width;
        instructionsBackground.height = instructions.height;
        instructionsBackground.top = instructions.top;
        instructionsBackground.left = instructions.left;
        instructionsBackground.paddingLeft = instructions.paddingLeft;
        instructionsBackground.horizontalAlignment = instructions.horizontalAlignment;
        instructionsBackground.verticalAlignment = instructions.verticalAlignment;
        instructionsBackground.cornerRadius = 3;
        advancedTexture.addControl(instructionsBackground);
        advancedTexture.addControl(instructions);
    }

    /** Helper UI function to create toggle buttons
     */
    private createToggleButton(text: string, backgroundColor: string, 
        onClickHandler:(eventData: GUI.Vector2WithInfo, eventState: EventState) => void
    ) {       
        const button = new GUI.Button();
        button.width = '100px';
        button.height = '50px';
        button.color = 'white';
        button.background = backgroundColor;
        button.cornerRadius = 3;
        button.thickness = 2;
        button.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        button.paddingRight = '5px'
        button.paddingBottom = '20px'

        const textBlock = new GUI.TextBlock();
        textBlock.text = text;
        button.addControl(textBlock);

        button.onPointerClickObservable.add(onClickHandler);

        return button;
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

        this.createEnvironment(scene);

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
            new Vector3(10, 10, -10),
            scene
        );
        camera.viewport = new Viewport(0, 0, 1, 1);
        camera.setTarget(Vector3.Zero());
        camera.attachControl(this.engine.getRenderingCanvas(), true);
        camera.keysUp = [87]; // W
        camera.keysDown = [83]; // S
        camera.keysLeft = [65]; // A
        camera.keysRight = [68]; // D
        camera.speed = 0.3; // slow down the camera movement

        // set camera layerMask to be able to render all
        camera.layerMask = LAYER_SCENE | LAYER_HMD | LAYER_FRUSTUM;

        // set a new camera to only render the GUI so that we can set it as the top layer to be interactible
        const guiCamera = new FreeCamera("guiCamera", Vector3.Zero(), scene);

        // Set the GUI camera to only render the UI layer
        guiCamera.layerMask = LAYER_UI;
        guiCamera.viewport = new Viewport(0, 0, 1, 1);

        // Ensure this secondary camera renders over the main camera
        scene.activeCameras = [camera, this.hmd.camL, this.hmd.camR, guiCamera]; // Render both cameras

        // Add UI controls to the scene
        this.addUI(this.hmd);

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
        let animSpeed = 2.0;
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

        // update the PIP viewport border
        this.updatePIPViewPortBorder();
    }

    /**
     * Update the PIP viewport border when the window (browser) is resized.
     */
    updatePIPViewPortBorder() {
        this.pipViewPortBorderL.width = `${this.pipViewPortWidth * 100}%`;
        this.pipViewPortBorderL.height = `${this.pipViewPortHeight * 100}%`;
        this.pipViewPortBorderL.left = `${this.pipViewPortX * 100}%`;

        this.pipViewPortBorderR.width = `${this.pipViewPortWidth * 100}%`;
        this.pipViewPortBorderR.height = `${this.pipViewPortHeight * 100}%`;
        this.pipViewPortBorderR.left = `${this.pipViewPortX * 100 + this.pipViewPortWidth * 100}%`;
    }
}
