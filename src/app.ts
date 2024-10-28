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

// DEBUG flag
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
    Color4,
    FreeCamera,
    Matrix,
} from "@babylonjs/core";

import { HMDParams } from "./hmdParams";
import { FrustumVisualizer } from "./frustumVisualizer";

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

        // set WASD speed lower
        camera.speed = 0.3;

        /////////////////
        // SCENE SETUP //
        
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

        //////////////////
        // VR HMD SETUP //
        // Note that the entities here are defined using the mesh as the parent
        
        // Create display mesh for the HMD
        const display = MeshBuilder.CreateBox('display', 
            {width: HMDParams.displayWidth, height: HMDParams.displayHeight, depth: HMDParams.displayDepth}, scene);
        display.enableEdgesRendering();
        display.edgesWidth = 1;
        display.visibility = 0.3;
        display.edgesColor = new Color4(0.5, 0.5, 1, 1);

        // Create lens mesh for the HMD, rotated to face the display
        const lensL = MeshBuilder.CreateCylinder('lens', 
            {diameter: HMDParams.lensDiameter, height: HMDParams.lensDepth, tessellation: 24}, scene);
        lensL.rotation.x = Math.PI / 2;
        lensL.enableEdgesRendering();
        lensL.edgesWidth = 1;
        lensL.visibility = 0.3;
        lensL.edgesColor = new Color4(0.5, 0.5, 1, 1);
        lensL.parent = display;
        lensL.position.x -= HMDParams.ipd/2;
        lensL.position.z -= HMDParams.distLens2Display;

        const lensR = MeshBuilder.CreateCylinder('lens', 
            {diameter: HMDParams.lensDiameter, height: HMDParams.lensDepth, tessellation: 24}, scene);
        lensR.rotation.x = Math.PI / 2;
        lensR.enableEdgesRendering();
        lensR.edgesWidth = 1;
        lensR.visibility = 0.3;
        lensR.edgesColor = new Color4(0.5, 0.5, 1, 1);
        lensR.parent = display;
        lensR.position.x += HMDParams.ipd/2;
        lensR.position.z -= HMDParams.distLens2Display;

        // Create a mesh to represent the eyes
        // NOTE: the positions are all relative to the display
        // TODO: get position values all from the hmdParams
        const eyeL = MeshBuilder.CreateSphere('eyeL', {diameter: HMDParams.eyeRadius}, scene);
        const eyeR = MeshBuilder.CreateSphere('eyeR', {diameter: HMDParams.eyeRadius}, scene);
        eyeL.parent = display;
        eyeR.parent = display;
        eyeL.position.x -= HMDParams.ipd / 2;
        eyeR.position.x += HMDParams.ipd / 2;
        eyeL.position.z -= HMDParams.distEye2Display;
        eyeR.position.z -= HMDParams.distEye2Display;

        // Create cameras for the eyes
        // - calculate the camera position based on the eye position relative to the display
        const camL = new FreeCamera('camL', eyeL.getAbsolutePosition(), scene);
        const camR = new FreeCamera('camR', eyeR.getAbsolutePosition(), scene);
        camL.setTarget(Vector3.Zero());
        camR.setTarget(Vector3.Zero());
        camL.parent = eyeL; // TODO: this does nothing
        camR.parent = eyeR;

        // make the eyes translucent and with a flesh like color
        const matEye = new StandardMaterial('eyeMatL', scene);
        matEye.diffuseColor.set(1, 0.8, 0.6);
        matEye.alpha = 0.5;
        eyeL.material = matEye;
        eyeR.material = matEye;

        /**
         * Update the HMD position and everything that depends on it.
         * @param newPos The new position to set the HMD to.
         */
        function updateHMDPosition(newPos = Vector3.Zero()) {
            HMDParams.pos.copyFrom(newPos);
            display.position.copyFrom(HMDParams.pos);

            // update the camera positions
            camL.position.copyFrom(eyeL.getAbsolutePosition());
            camR.position.copyFrom(eyeR.getAbsolutePosition());
        }

        /**
         * Set the projection matrix for the camera representing an eye. Note that 
         * this is done separately for each eye.
         * @remarks This function sets the projection matrix for the camera using:
         *         - the interpupillary distance (ipd)
         *         - the distance from the lenses to the display screen (distLens2Display)
         *         - the focal length of the lenses (f)
         *         - the width of the display screen (displayWidth)
         *         - the height of the display screen (displayHeight)
         *         - the distance from the eye to the display (distEye2Display)
         *         
         *         The makePerspective is from THREE.js 
         *         https://github.com/mrdoob/three.js/blob/dev/src/math/Matrix4.js#L777
         */
        function setProjection(camera: FreeCamera) {
            // calculate magnification factor
            // - note that if f < distLens2Display, then it will be -ve
            // - else it will be +ve
            // - when f = distLens2Display, the magFactor will be infinite
            const magnification = HMDParams.f / (HMDParams.f - HMDParams.distLens2Display);

            // calculate the distance from the lens to the virtual image
            // - for HMD, the f needs to be > distLens2Display (or the object distance)
            // - this results in a -ve value for distLens2Img 
            //   which means the virtual image is on the same side as the object
            // - this is similar to a magnifying glass (as opposed to a projector)
            const distLens2Img = 1 / (1 / HMDParams.f - 1 / HMDParams.distLens2Display);

            // calculate the full height of the virtual image for the particular eye
            const imgHeight = HMDParams.displayHeight * magnification;

            // calculate the width of the virtual image for the particular eye
            const imgWidth = HMDParams.displayWidth * magnification;
            
            // calculate the distance from the eye to the virtual image
            // - make distLens2Img abs for calculations
            // - it is -ve in conceptual terms
            const distEye2Img = HMDParams.eyeRelief + Math.abs(distLens2Img);

            // calculate the near plane distance
            // - this should start at minimum the position of the display
            // - TODO: perhaps add a small offset to ensure the near plane is not too close
            const near = HMDParams.distEye2Display;

            // calculate the far plane distance
            // - this does not have to be exact, but should be far enough to encompass the scene
            // - for testing purposes, set it to be 5 units away from the near plane
            const far = near + 5;

            // set remaining params for projection
            // - the fov is the vertical fov
            const fov = 2 * Math.atan((imgHeight / 2) / distEye2Img);
            const minZ = near;
            const maxZ = far;


            // calculate the left, right, top, and bottom values for the off-axis projection
            // - this was adapted from THREE.js's Matrix4.makePerspective function
            // - the built-in Babylon.js function does not allow for off-axis projection
            // - this is a manual calculation of the projection Matrix
            const top = HMDParams.distEye2Display * imgHeight / (2 * distEye2Img);
            const bottom = -top;
            const imgWidthNasal = magnification * HMDParams.ipd / 2;
            const imgWidthTemporal = magnification * (HMDParams.displayWidth - HMDParams.ipd) / 2;
            const right = HMDParams.distEye2Display * imgWidthNasal / distEye2Img;
            const left = -HMDParams.distEye2Display * imgWidthTemporal / distEye2Img;

            if (DEBUG) {
                console.log('BEFORE updating camera projection matrix:'); 
                console.log(camera.getProjectionMatrix().toString());
                console.log('calculated top:', top, 'bottom:', bottom, 'right:', right, 'left:', left);
            }

            // manually create the LH off-axis projection matrix
            const x = 2 * near / ( right - left );
            const y = 2 * near / ( top - bottom );
            const a = ( right + left ) / ( right - left );
            const b = ( top + bottom ) / ( top - bottom );
            let c, d;
            //if ( coordinateSystem === WebGLCoordinateSystem ) {
            c = - ( far + near ) / ( far - near );
            d = ( - 2 * far * near ) / ( far - near );
            //} else if ( coordinateSystem === WebGPUCoordinateSystem ) {
            //c = - far / ( far - near );
            //d = ( - far * near ) / ( far - near );
            const projMat = Matrix.FromValues(
                x, 0, 0, 0,
                0, y, 0, 0,
                a, b, c, -1,
                0, 0, d, 0
            );

            if (DEBUG) {
                console.log('Manually created projection matrix:');
                console.log(projMat.toString());
            }

            // this built-in function does not allow for off-axis projection
            // - the frustum is symmetrical both horizontally and vertically
            //const projMat = Matrix.PerspectiveFovLH(fov, hmdParams.aspectRatio, minZ, maxZ);
            
            // apply the new projection matrix to the camera
            camera.freezeProjectionMatrix(projMat);
            //cam._projectionMatrix.copyFrom(projMat); // alternative
            //cam._projectionMatrix = projMat; // alternative

            // MANUALLY set the values to the simulated camera where possible
            // TODO: very odd that the values are not updated no matter which of the 
            //       above methods are used
            //       on the canvas size, so it is not settable
            //camera.minZ = minZ;
            //camera.maxZ = maxZ;
            //camera.fov = fov;

            // Set the camera to "dirty" so Babylon.js knows to use this new matrix
            camera.markAsDirty();

            // affect all changes in camera to take effect
            camera.unfreezeProjectionMatrix()

            if (DEBUG) {
                // log above in nice format
                console.log("----------------------------------");
                console.log("HMD PARAMETERS");
                console.log("ipd:", HMDParams.ipd);
                console.log("eyeRelief:", HMDParams.eyeRelief);
                console.log("f:", HMDParams.f);
                console.log("distLens2Display:", HMDParams.distLens2Display);
                console.log("distEye2Display:", HMDParams.distEye2Display);
                console.log("displayWidth:", HMDParams.displayWidth);
                console.log("displayHeight:", HMDParams.displayHeight);
                console.log("aspectRatio:", HMDParams.aspectRatio);
                console.log("----------------------------------");
                console.log("EYE POSITION (does not affect projection)");
                console.log(
                    "eyePosL:",
                    eyeL.getAbsolutePosition(),
                    "eyePosR:",
                    eyeR.getAbsolutePosition()
                );
                console.log("----------------------------------");
                console.log("CALCULATED OTHER VALUES");
                console.log("magFactor:", magnification);
                console.log("imgWidth:", imgWidth);
                console.log("imgHeight:", imgHeight);
                console.log("distLens2Img:", distLens2Img);
                console.log("distEye2Img:", distEye2Img);
                console.log("----------------------------------");
                console.log("NEAR AND FAR PLANES");
                console.log("near:", near);
                console.log("far:", far);
                console.log("----------------------------------");
                console.log(
                    "PROJECTION MATRIX after updating with freezeProjectionMatrix"
                );
                console.log(projMat.toString());
                console.log("----------------------------------");
                console.log(
                    "CAMERA PARAMS after updating with freezeProjectionMatrix"
                );
                console.log("fov:", camera.fov);
                console.log("minZ:", camera.minZ);
                console.log("maxZ:", camera.maxZ);
                console.log("----------------------------------");
            }
            // return the projection Matrix
            return projMat;
        }

        // Get the projection matrix for the left eye
        const projMat = setProjection(camL);
        
        // DEBUG: make camL look up the y-axis
        //camL.upVector = new Vector3(0, 0, -1);
        //camL.setTarget(camL.position.add(new Vector3(0, 1, 0)));
        //const viewMat = camL.getViewMatrix();
        //const transformMat = camL.getWorldMatrix();
        
        // get view and transform matrices from HMD
        const viewMat = HMDParams.viewMatrixL;
        const transformMat = HMDParams.transformMatrix;

        console.log('createScene: Projection matrix:', projMat.toString());
        console.log('createScene: View matrix:', viewMat.toString());
        console.log('createScene: Transform matrix:', transformMat.toString());
        
        // Create a test view matrix that looks to the front
        //const viewMat = Matrix.LookAtLH(eyeL.position, Vector3.Zero(), Vector3.Up());

        // Create the frustum mesh for the left eye
        //const frustumLines = createFrustumLines(scene, projMat, viewMat, transformMat);
        const frustumVisualizer = new FrustumVisualizer(projMat, viewMat, transformMat, scene);

        // Update the frustum mesh for the left eye
        let elapsedSecs = 0.0;
        let animSpeed = 2.0;
        const newPos = HMDParams.pos.clone();
        scene.onBeforeRenderObservable.add(() => {
            // move the HMD in a sine wave oscillation to show changes in the frustum
            elapsedSecs += scene.getEngine().getDeltaTime() / 1000;
            newPos.x = Math.sin(elapsedSecs * 0.1) * animSpeed;
            updateHMDPosition(newPos);

            // update the projection matrix for the left eye
            // setProjection(camL, eyePosL);
            
            // update the frustum mesh for the left eye
            //updateFrustum(camL, frustumL, eyePosL);

            // Get the projection matrix for the left eye
            //const projMat = setProjection(camL);

            // DEBUG: make camL look up the y-axis
            //camL.upVector = new Vector3(0, 0, -1);
            //camL.setTarget(camL.position.add(new Vector3(0, 1, 0)));
            //const viewMat = camL.getViewMatrix();
            //const transformMat = camL.getWorldMatrix();

            // get transform matrix from HMD
            const transformMat = HMDParams.transformMatrix;
            const viewMat = HMDParams.viewMatrixL;

            //console.log('createScene: Projection matrix:', projMat.toString());
            //console.log('createScene: View matrix:', viewMat.toString());
            //console.log('createScene: Transform matrix:', transformMat.toString());

            //updateFrustumLines(frustumLines, projMat, viewMat, transformMat);
            frustumVisualizer.updateFrustumMesh(projMat, viewMat, transformMat);

            // refresh the scene
            //frustumL.disableEdgesRendering();
            //frustumL.enableEdgesRendering();
        });

        // Return the scene when it is ready
        return scene;
    }
}
