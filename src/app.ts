/**
 * @fileoverview The main application class for the project.
 * @author your instructors
 * @lastUpdated 2024-01-04
 */

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
    ArcRotateCamera,
    Color4,
    FreeCamera,
    Matrix,
    Mesh,
    VertexBuffer,
    Nullable,
    Vector4,
    Viewport,
    Camera
} from "@babylonjs/core";

/**
 * The parameters for the VR HMD.
 * - TODO: think about whether eyeRelief should be > f so that the 
 *   virtual image is on the same side as the object
 * - Note that Cardboard 2.0's params are:
 *   f: 40mm
 *   ipd: 64mm
 *   eyeRelief: 18mm
 *   distLens2Display: 39mm
 *   displayWidth: 120.96mm
 *   displayHeight: 68.03mm
 */
const hmdParams = {
    f: 0.4,
    ipd: 0.68,
    eyeRelief: 0.18,
    distLens2Display: 0.39,
    displayWidth: 1.2096,
    displayHeight: 0.6803,
    get aspectRatio() {
        return this.displayWidth / this.displayHeight;
    },
    get distEye2Display() {
        return this.eyeRelief + this.distLens2Display;
    }
}

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
    async createScene() {
        // Create the BabylonJS scene
        const scene = new Scene(this.engine);
        scene.clearColor.set(0.15, 0.15, 0.15, 1);

        // Create a arcRotate camera and attach it to the canvas
        const camera = new ArcRotateCamera('camera', 5, 1, 20, new Vector3(0, 0, 0), scene);
        camera.attachControl(this.engine.getRenderingCanvas(), true);

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
        
        // init the eye positions in the HMD
        const eyePosL = new Vector3(0, 2, -5);
        
        // Create a camera for the left eye
        const camL = new FreeCamera('camL', new Vector3(-5, 2, 0), scene);
        camL.minZ = 2;
        camL.maxZ = 30;
        camL.projectionPlaneTilt = 0.0;

        // Create a mesh to represent the left eye
        const eyeL = MeshBuilder.CreateSphere('eyeL', {diameter: 0.2}, scene);
        eyeL.parent = camL;

        // make the eye translucent
        const matEye = new StandardMaterial('eyeMatL', scene);
        matEye.diffuseColor.set(0.5, 0.5, 0.5);
        matEye.alpha = 0.5;
        eyeL.material = matEye;

        // Create display mesh for the HMD
        const display = MeshBuilder.CreateBox('display', 
            {width: hmdParams.displayWidth, height: hmdParams.displayHeight, depth: 0.05}, scene);
        display.enableEdgesRendering();
        display.edgesWidth = 1;
        display.visibility = 0.3;
        display.edgesColor = new Color4(0.5, 0.5, 1, 1);

        // Create lens mesh for the HMD, rotated to face the display
        const lensL = MeshBuilder.CreateCylinder('lens', {diameter: 1, height: 0.05, tessellation: 24}, scene);
        lensL.rotation.x = Math.PI / 2;
        lensL.enableEdgesRendering();
        lensL.edgesWidth = 1;
        lensL.visibility = 0.3;
        lensL.edgesColor = new Color4(0.5, 0.5, 1, 1);

        /**
         * Update the respective lens and display relative to the eye position
         * @param eyePos The position of the eye to update the lens and display for
         * @param lens The lens mesh to update
         * @param display The display mesh to update
         * @remarks This is called every frame to update the position of the lens and display
         */
        function updateLensDisplay(eyePos: Vector3, lens: Mesh, display: Mesh) {
            lens.position.copyFrom(eyePos);
            lens.position.z += hmdParams.eyeRelief;
            display.position.copyFrom(eyePos);
            display.position.z += hmdParams.eyeRelief + hmdParams.distLens2Display;
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
         */
        function setProjection(camera: FreeCamera, eyePos: Vector3) {
            // calculate magnification factor
            // - note that if f < distLens2Display, then it will be -ve
            // - else it will be +ve
            // - when f = distLens2Display, the magFactor will be infinite
            const magnification = hmdParams.f / (hmdParams.f - hmdParams.distLens2Display);

            // calculate the distance from the lens to the virtual image
            // - for HMD, the f needs to be > distLens2Display (or the object distance)
            // - this results in a -ve value for distLens2Img 
            //   which means the virtual image is on the same side as the object
            // - this is similar to a magnifying glass (as opposed to a projector)
            const distLens2Img = 1 / (1 / hmdParams.f - 1 / hmdParams.distLens2Display);

            // calculate the full height of the virtual image for the particular eye
            const imgHeight = hmdParams.displayHeight * magnification;

            // calculate the width of the virtual image for the particular eye
            const imgWidth = hmdParams.displayWidth * magnification;
            
            // calculate the distance from the eye to the virtual image
            // - make distLens2Img abs for calculations
            // - it is -ve in conceptual terms
            const distEye2Img = hmdParams.eyeRelief + Math.abs(distLens2Img);

            // calculate the near plane distance
            // - this should start at minimum the position of the display
            // - TODO: perhaps add a small offset to ensure the near plane is not too close
            const near = hmdParams.distEye2Display;

            // calculate the far plane distance
            // - this does not have to be exact, but should be far enough to encompass the scene
            const far = near + 10;

            // set remaining params for projection
            // - the fov is the vertical fov
            const fov = 2 * Math.atan((imgHeight / 2) / distEye2Img);
            const minZ = near;
            const maxZ = far;

            // DEBUG: show the values
            console.log('BEFORE updating camera projection matrix:', 
                camera.getProjectionMatrix().toString());

            // calculate the left, right, top, and bottom values for the off-axis projection
            const top = hmdParams.distEye2Display * imgHeight / (2 * distEye2Img);
            const bottom = -top;
            const imgWidthNasal = magnification * hmdParams.ipd / 2;
            const imgWidthTemporal = magnification * (hmdParams.displayWidth - hmdParams.ipd) / 2;
            const right = hmdParams.distEye2Display * imgWidthNasal / distEye2Img;
            const left = -hmdParams.distEye2Display * imgWidthTemporal / distEye2Img;

            // manually create the off-axis projection matrix
            // - the built-in Babylon.js function does not allow for off-axis projection
            // - this is a manual calculation of the projection Matrix
            // - note that the values are not updated in the camera object
            const projMat = Matrix.FromValues(
                2 * near / (right - left), 0, (right + left) / (right - left), 0,
                0, 2 * near / (top - bottom), (top + bottom) / (top - bottom), 0,
                0, 0, -(far + near) / (far - near), -2 * far * near / (far - near),
                0, 0, -1, 0
            );

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

            camera.mode = Camera.PERSPECTIVE_CAMERA;

            // Set the camera to "dirty" so Babylon.js knows to use this new matrix
            camera.markAsDirty();

            // affect all changes in camera to take effect
            camera.unfreezeProjectionMatrix()

            // DEBUG: show values
            console.log('AFTER updating camera projection matrix:', 
                    camera.getProjectionMatrix().toString());
            //
            // DEBUG: show the values
            //console.log('ipd: ', ipd, 'eyeRelief: ', eyeRelief, 'f: ', f, 
                //'distLens2Display: ', distLens2Display , 'displayWidth: ',
                //displayWidth, 'displayHeight: ', displayHeight);
            //console.log('eyePos:', eyePos.toString());
            //console.log('fov:', camera.fov, 'minZ:', camera.minZ, 'maxZ:', camera.maxZ, 
                //'aspectRatio:', aspectRatio);
            //console.log('magFactor:', magFactor);
            //console.log('imgWidth:', imgWidth, 'imgHeight:', imgHeight);
            //console.log('distEye2Display:', distEye2Display, 'distEye2Img:', 
                //distEye2Img, 'distLens2Img:', distLens2Img);
            //console.log('near:', near, 'far:', far);

            // log above in nice format
            console.log('----------------------------------');
            console.log('HMD PARAMETERS');
            console.log('ipd:', hmdParams.ipd);
            console.log('eyeRelief:', hmdParams.eyeRelief);
            console.log('f:', hmdParams.f);
            console.log('distLens2Display:', hmdParams.distLens2Display);
            console.log('distEye2Display:', hmdParams.distEye2Display);
            console.log('displayWidth:', hmdParams.displayWidth);
            console.log('displayHeight:', hmdParams.displayHeight);
            console.log('aspectRatio:', hmdParams.aspectRatio);
            console.log('----------------------------------');
            console.log('EYE POSITION');
            console.log('eyePos:', eyePos.toString());
            console.log('----------------------------------');
            console.log('CALCULATED OTHER VALUES');
            console.log('magFactor:', magnification);
            console.log('imgWidth:', imgWidth);
            console.log('imgHeight:', imgHeight);
            console.log('distLens2Img:', distLens2Img);
            console.log('distEye2Img:', distEye2Img);
            console.log('----------------------------------');
            console.log('NEAR AND FAR PLANES');
            console.log('near:', near);
            console.log('far:', far);
            console.log('----------------------------------');
            console.log('CAMERA PARAMS');
            console.log('fov:', camera.fov);
            console.log('minZ:', camera.minZ);
            console.log('maxZ:', camera.maxZ);

            // return the projection Matrix
            return projMat;
        }

        /**
         * Calculate the corners of the frustum in world space.
         * @param cam The camera to calculate the frustum corners for.
         * @returns The corners of the frustum in world space.
         * @remarks This function calculates the corners of the frustum in world space.
         *         The corners are calculated by transforming the corners of the frustum
         *         in view space to world space.
         *         The corners are calculated for both the near and far planes.
         */
        function calculateFrustumCorners(cam: FreeCamera) {
            const nearPlane = cam.minZ;
            const farPlane = cam.maxZ;
            const fov = cam.fov;
            const tanFov = Math.tan(fov / 2);

            // Near plane dimensions
            const nearHeight = 2 * tanFov * nearPlane;
            const nearWidth = nearHeight * hmdParams.aspectRatio;

            // Far plane dimensions
            const farHeight = 2 * tanFov * farPlane;
            const farWidth = farHeight * hmdParams.aspectRatio;

            const viewMatrix = cam.getViewMatrix();
            const inverseViewMatrix = Matrix.Invert(viewMatrix);

            // Corners in view space
            const corners = [
                // Near plane
                new Vector3(-nearWidth / 2, nearHeight / 2, nearPlane),   // Top Left
                new Vector3(nearWidth / 2, nearHeight / 2, nearPlane),    // Top Right
                new Vector3(-nearWidth / 2, -nearHeight / 2, nearPlane),  // Bottom Left
                new Vector3(nearWidth / 2, -nearHeight / 2, nearPlane),   // Bottom Right

                // Far plane
                new Vector3(-farWidth / 2, farHeight / 2, farPlane),      // Top Left
                new Vector3(farWidth / 2, farHeight / 2, farPlane),       // Top Right
                new Vector3(-farWidth / 2, -farHeight / 2, farPlane),     // Bottom Left
                new Vector3(farWidth / 2, -farHeight / 2, farPlane)       // Bottom Right
            ];

            // Transform corners to world space
            return corners.map(corner => Vector3.TransformCoordinates(corner, inverseViewMatrix));
        }

        // Create lines to represent the frustum box
        function createFrustumLines(scene: Nullable<Scene> | undefined, camera: FreeCamera) {

            const corners = calculateFrustumCorners(camera);

            const lines = [];

            // Connect near plane
            lines.push(
                [corners[0], corners[1]], 
                [corners[1], corners[3]], 
                [corners[3], corners[2]], 
                [corners[2], corners[0]]);
            
            // Connect far plane
            lines.push(
                [corners[4], corners[5]], 
                [corners[5], corners[7]], 
                [corners[7], corners[6]],
                [corners[6], corners[4]]);

            // Connect near and far planes
            lines.push(
                [corners[0], corners[4]], 
                [corners[1], corners[5]], 
                [corners[2], corners[6]], 
                [corners[3], corners[7]]);

            return MeshBuilder.CreateLineSystem("frustum", { lines }, scene);
        }

        function updateFrustumLines(frustum: Mesh, camera: FreeCamera) {
            // DEBUG: show camera frustum parameters
            //console.log('updateFrustumLines: Camera parameters:', camera.fov, camera.minZ, camera.maxZ);

            // calcuate new corners
            const corners = calculateFrustumCorners(camera);

            // get current frustum lines
            const linesVertices = frustum.getVerticesData('position');

            // Define the mapping of `linesVertices` indices to `corners` indices
            const indexMapping = [
                // near plane
                [0, 0], [3, 1], [6, 1], [9, 3], [12, 3], [15, 2], [18, 2], [21, 0],

                // far plane
                [24, 4], [27, 5], [30, 5], [33, 7], [36, 7], [39, 6], [42, 6], [45, 4],

                // near to far plane
                [48, 0], [51, 4], [54, 1], [57, 5], [60, 2], [63, 6], [66, 3], [69, 7]
            ];

            // Update frustum lines
            if (linesVertices) {
                indexMapping.forEach(([lineIndex, cornerIndex]) => {
                    linesVertices[lineIndex] = corners[cornerIndex].x;
                    linesVertices[lineIndex + 1] = corners[cornerIndex].y;
                    linesVertices[lineIndex + 2] = corners[cornerIndex].z;
                });

                // Update the frustum mesh with the new lines
                frustum.setVerticesData(VertexBuffer.PositionKind, linesVertices);
            }
        }

        // Create a box to represent the frustum
        //const frustumBox = createFrustumBox(scene, camL);
        const frustumLines = createFrustumLines(scene, camL);

        // Update the frustum mesh for the left eye
        let elapsedSecs = 0.0;
        let animSpeed = 2.0;
        scene.onBeforeRenderObservable.add(() => {
            // move the eye position in a sine wave oscillation to show changes in the frustum
            elapsedSecs += scene.getEngine().getDeltaTime() / 1000;
            eyePosL.x = Math.sin(elapsedSecs * 0.1) * animSpeed;

            // update the lens and display meshes for the left eye
            updateLensDisplay(eyePosL, lensL, display);

            // update camera position to match the eye position
            camL.position.copyFrom(eyePosL);

            // update the projection matrix for the left eye
            // setProjection(camL, eyePosL);
            
            // update the frustum mesh for the left eye
            //updateFrustum(camL, frustumL, eyePosL);
            updateFrustumLines(frustumLines, camL);

            // refresh the scene
            //frustumL.disableEdgesRendering();
            //frustumL.enableEdgesRendering();
        });

        // DEBUG
        setProjection(camL, eyePosL);

        // Return the scene when it is ready
        return scene;
    }
}
