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
    Nullable
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
        const camera = new ArcRotateCamera('camera', 5, 1, 20, new Vector3(0, 0, 0), scene);
        camera.attachControl(this.engine.getRenderingCanvas(), true);

        // create a hemispheric light
        const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.6;

        // create a directional light that will cast shadows
        // TODO: create keys to move light
        const dirLight = new DirectionalLight('dirLight', new Vector3(0, -1, -1), scene);
        dirLight.position = new Vector3(0, 10, 10);
        dirLight.intensity = 0.3;
        dirLight.shadowEnabled = true;
        dirLight.shadowMinZ = 1;
        dirLight.shadowMaxZ = 100;

        // Create shadow generator for the directional light
        const shadowGenerator = new ShadowGenerator(1024, dirLight);
        shadowGenerator.useBlurExponentialShadowMap = true;

        // Create grid material with finer grid lines
        const mat1 = new StandardMaterial('red', scene);
        mat1.diffuseColor.set(1, .3, .5);
        const mat2 = new StandardMaterial('green', scene);
        mat2.diffuseColor.set(.5, 1, .6);
        const mat3 = new StandardMaterial('blue', scene);
        mat3.diffuseColor.set(.3, .5, 1);

        // Create a box with the grid material and shift it up and left, and rotate
        const box = MeshBuilder.CreateBox('box', {size: 2}, scene);
        box.position.y = 2;
        box.position.x = -2;
        box.rotation = new Vector3(Math.PI / 4, Math.PI / 4, 10);
        box.material = mat1;
        box.receiveShadows = true;
        shadowGenerator.addShadowCaster(box);

        // Create a cone with the grid material and shift it up and right
        const tor = MeshBuilder.CreateTorusKnot('tor', 
            {radius: 1, tube: 0.35, radialSegments: 100, tubularSegments: 20}, scene);
        tor.position.y = 2;
        tor.position.x = 2;
        tor.material = mat3;
        tor.receiveShadows = true;
        shadowGenerator.addShadowCaster(tor);

        // Create a ground plane with the grid material
        const ground = CreateGround('ground', {width: 10, height: 10}, scene);
        ground.material = mat2;
        ground.receiveShadows = true;
        ground.position.y = -1;

        //////////////
        // Frustums //
        //const frustumL = MeshBuilder.CreateBox('frustumL', {size: 2}, scene);
        //frustumL.position = new Vector3(-5, 2, 0);
        //frustumL.enableEdgesRendering();
        //frustumL.edgesWidth = 1;
        //frustumL.edgesColor = new Color4(1, 0.5, 0.5, 1);
        //frustumL.visibility = 0.1;

        //try {
            //const positionData = frustumL.getPositionData();
            //const initPositions = new Float32Array(positionData);
            //// Continue processing with initPositions...
        //} catch (error) {
            //console.error(
                //"An error occurred while initializing positions:",
                //error
            //);
            //// Handle the error case, e.g., set default values or take alternative actions.
        //}

        // Create a camera for the left eye
        const camL = new FreeCamera('camL', new Vector3(-5, 2, 0), scene);
        camL.minZ = 2;
        camL.maxZ = 30;
        camL.projectionPlaneTilt = 0.0;

        // Creata a mesh to represent the left eye
        const eyeL = MeshBuilder.CreateSphere('eyeL', {diameter: 0.8}, scene);
        eyeL.parent = camL;

        // Create focal plane
        let screenHalfHeight = 0.5;
        let distToScreen = 8;
        let aspectRatio = 16 / 9;
        const focalPlane = MeshBuilder.CreatePlane('focalPlane', {size: 1}, scene);
        focalPlane.scaling.copyFromFloats(2 * screenHalfHeight * aspectRatio, 2 * screenHalfHeight, 1);
        focalPlane.enableEdgesRendering();
        focalPlane.edgesWidth = 1;
        focalPlane.visibility = 0.1;
        focalPlane.edgesColor = new Color4(0.5, 0.5, 1, 1);

        /**
         * Set the projection matrix for the camera.
         * @param cam The camera to set the projection for.
         * @param camOffset The camera position in local space.
         * @param screenHalfHeight The half height of the screen.
         * @returns The projection matrix.
         * @remarks This function sets the projection matrix for the camera.
         */
        function setProjection(cam: FreeCamera, camOffset: Vector3, screenHalfHeight: number) {
            // get the engine from the camera
            const engine = cam.getEngine();

            // set the camera's position to the offset
            cam.position.x = camOffset.x;
            cam.position.y = camOffset.y;
            cam.position.z = -Math.abs(camOffset.z);

            // distance to the focal plane is calculated as the absolute value of the 
            // camera's z position
            const distToFocalPlane = Math.abs(cam.position.z);

            // calculate the field of view based on the screen half height and the distance
            cam.fov = 2 * Math.atan(screenHalfHeight / distToFocalPlane);

            // calculate the projection matrix
            const projMat = Matrix.PerspectiveFovLH(cam.fov, aspectRatio, cam.minZ, cam.maxZ, 
                engine.isNDCHalfZRange, cam.projectionPlaneTilt, engine.useReverseDepthBuffer);

            // add the camera offset to the projection matrix
            // - this is done by adding the x and y position of the camera to the 8th and 9th
            //   elements of the projection matrix
            // - the 8th and 9th elements of the projection matrix are the x and y components
            // - starting from the first element, the elements refer to the following:
            //   0  1  2  3
            //   4  5  6  7
            //   8  9  10 11
            //   12 13 14 15
            projMat.addAtIndex(8, cam.position.x / (screenHalfHeight * aspectRatio));
            projMat.addAtIndex(9, cam.position.y / screenHalfHeight);

            // finally set camera's projection matrix to the new projection matrix
            cam._projectionMatrix.copyFrom(projMat);

            return projMat;
        }

        /**
         * Update the frustum mesh to match the camera's frustum.
         * @param cam The camera to update the frustum for.
         * @param frustum The frustum mesh to update.
         * @param eyePos The offset of the camera from the center.
         * @remarks This function updates the frustum mesh to match the camera's frustum.
         *          The frustum mesh is updated by transforming the frustum mesh's vertices
         *          to the view space of the camera.
         */
        function updateFrustum(cam: FreeCamera, frustum: Mesh, eyePos: Vector3) {
            // get the projection matrix
            const projMat = setProjection(cam, eyePos, screenHalfHeight);

            // get the inverse of the projection matrix
            const invProjMat = projMat.clone().invert();

            // get the inverse of the view matrix
            const invViewMat = cam.getViewMatrix().clone().invert();

            // get the positions of the frustum mesh
            const positions = frustum.getVerticesData('position');

            // transform the positions to view space using the matrices above
            // and set the new positions as the new vertices of the frustum mesh
            if (positions) {
                const newPositions = new Float32Array(positions.length);
                for (let i = 0; i < positions.length; i += 3) {
                    const pos = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
                    const worldPos = Vector3.TransformCoordinates(pos, invProjMat);
                    const viewPos = Vector3.TransformCoordinates(worldPos, invViewMat);
                    newPositions[i] = viewPos.x;
                    newPositions[i + 1] = viewPos.y;
                    newPositions[i + 2] = viewPos.z;
                }

                //frustum.updateVerticesData('position', newPositions);
                frustum.setVerticesData(VertexBuffer.PositionKind, newPositions);
            }
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
            const aspectRatio = cam.getEngine().getAspectRatio(cam);
            const nearPlane = cam.minZ;
            const farPlane = cam.maxZ;
            const fov = cam.fov;

            const tanFov = Math.tan(fov / 2);

            // Near plane dimensions
            const nearHeight = 2 * tanFov * nearPlane;
            const nearWidth = nearHeight * aspectRatio;

            // Far plane dimensions
            const farHeight = 2 * tanFov * farPlane;
            const farWidth = farHeight * aspectRatio;

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
        const eyePosL = new Vector3(0, 2, 0);
        let elapsedSecs = 0.0;
        scene.onBeforeRenderObservable.add(() => {
            // move the eye position in a sine wave oscillation to show changes in the frustum
            elapsedSecs += scene.getEngine().getDeltaTime() / 1000;
            eyePosL.x = Math.sin(elapsedSecs * 0.1) * 1;
            eyePosL.z = -distToScreen;

            // update camera position to match the eye position
            camL.position.copyFrom(eyePosL);
            
            // update the frustum mesh for the left eye
            //updateFrustum(camL, frustumL, eyePosL);
            updateFrustumLines(frustumLines, camL);

            // refresh the scene
            //frustumL.disableEdgesRendering();
            //frustumL.enableEdgesRendering();
        });

        // Return the scene when it is ready
        return scene;
    }
}
