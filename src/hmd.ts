/**
 * @file HMD representing a VR headset's parameters and functionalities, 
 *       including setup for simulated eye cameras and their projections.
 * @author Chek
 * @lastUpdated 28 Oct 2024
 */
const DEBUG = false;

import {
    FreeCamera,
    Matrix,
    Scene,
    Vector3,
    Color4,
    MeshBuilder,
    Mesh,
    Observable,
    RenderTargetTexture,
} from "@babylonjs/core";

export class HMD {
    private scene: Scene;

    [key: string]: any; // Index signature to allow dynamic keys

    /**
     * The parameters for the VR HMD.
     *
     * Note that Cardboard 2.0's are:
     *   f: 40mm
     *   ipd: 64mm
     *   eyeRelief: 18mm
     *   distLens2Display: 39mm
     *   displayWidth: 120.96mm
     *   displayHeight: 68.03mm
     *   lensDiameter: 34mm
     *
     * TODO: think about whether eyeRelief should be > f so that the 
     *   virtual image is on the same side as the object
     */
    pos = new Vector3(0, 2, -5);
    f = .4;
    ipd = .6;
    eyeRelief = .18;
    distLens2Display = .41;
    displayWidth = 1.2096;
    displayHeight = .6803;
    displayDepth = .05;
    lensDiameter = .34;
    lensDepth = .05;
    eyeDiameter = .15;

    // Calculated values
    distEye2Display = this.eyeRelief + this.distLens2Display
    magnification = this.f / (this.f - this.distLens2Display);
    imgHeight = this.displayHeight * this.magnification;
    distLens2Img = 1 / (1 / this.f - 1 / this.distLens2Display);
    distEye2Img = Math.abs(this.distLens2Img) + this.eyeRelief;
    near = this.distEye2Display;
    far = this.near + 8;
    aspectRatio = this.displayWidth / this.displayHeight;
    fovVertical = 2 * Math.atan((this.imgHeight / 2) / this.distEye2Img);
    fovHNasal = Math.atan((this.magnification * this.ipd / 2) / this.distEye2Img);
    fovHTemporal = Math.atan((this.magnification * (this.displayWidth - this.ipd) / 2) 
                   / this.distEye2Img);
    fovHorizontal = this.fovHNasal + this.fovHTemporal;
    eyePosL = this.pos.clone().add(new Vector3(-this.ipd / 2, 0, -this.distEye2Display)); 
    eyePosR = this.pos.clone().add(new Vector3(this.ipd / 2, 0, -this.distEye2Display));

    // Calculated values for the off-axis projection
    top = this.near * this.imgHeight / (2 * this.distEye2Img);
    bottom = -this.top;
    imgWidthNasal = this.magnification * this.ipd / 2;
    imgWidthTemporal = this.magnification * (this.displayWidth - this.ipd) / 2;

    rightForLeftEye = this.distEye2Display * this.imgWidthNasal / this.distEye2Img;
    leftForLeftEye = -this.distEye2Display * this.imgWidthTemporal / this.distEye2Img

    rightForRightEye = this.distEye2Display * this.imgWidthTemporal / this.distEye2Img;
    leftForRightEye = -this.distEye2Display * this.imgWidthNasal / this.distEye2Img;

    // cache the projection matrix
    projMatL = Matrix.Identity();
    projMatR = Matrix.Identity();

    // cameras for the left and right eyes
    camL: FreeCamera;
    camR: FreeCamera;

    // meshes for the display, lenses, and eyes
    // - using ! to suppress the error that the properties are not initialized
    //   since they are initialized in the constructor through another method
    private display!: Mesh;
    private lensL!: Mesh;
    private lensR!: Mesh;
    private eyeL!: Mesh;
    private eyeR!: Mesh;

    /**
     * Create a world transform matrix for the HMD.
     * @returns The world transform matrix for the HMD.
     */
    get transformMatrix() {
        return Matrix.Translation(this.pos.x, this.pos.y, this.pos.z);
    }

    /**
     * Create a list of the parameters for the HMD.
     * @returns The list of parameters for the HMD 
     *          that can be used in a for (let key in hmd.params) loop.
     */
    get displayParams() {
        return {
            //pos: this.pos,
            f: this.f,
            ipd: this.ipd,
            eyeRelief: this.eyeRelief,
            distLens2Display: this.distLens2Display,
            displayWidth: this.displayWidth,
            displayHeight: this.displayHeight,
            //displayDepth: this.displayDepth,
            //lensDiameter: this.lensDiameter,
            //lensDepth: this.lensDepth,
            //eyeDiameter: this.eyeDiameter,
        };
    }
    
    /**
     * Create a list of params to be used as sliders for the HMD.
     */
    get sliderParams() {
        return {
            f: { min: 0.1, max: 2, step: 0.01 },
            ipd: { min: 0.001, max: 2, step: 0.01 },
            eyeRelief: { min: 0.001, max: 10, step: 0.01 },
            distLens2Display: { min: 0.1, max: 2, step: 0.01 },
            displayWidth: { min: 0.5, max: 5, step: 0.01 },
            displayHeight: { min: 0.5, max: 5, step: 0.01 },
            //displayDepth: { min: 0.01, max: 0.1, step: 0.01 },
            //lensDiameter: { min: 0.1, max: 0.5, step: 0.01 },
            //lensDepth: { min: 0.01, max: 0.1, step: 0.01 },
            //eyeDiameter: { min: 0.1, max: 0.5, step: 0.01 },
        };
    }

    /**
     * Create a list of the calculated values for the HMD.
     * @returns The list of calculated values for the HMD.
     */
    get displayCalculatedVals() {
        return {
            magnification: this.magnification,
            imgHeight: this.imgHeight,
            distLens2Img: this.distLens2Img,
            distEye2Img: this.distEye2Img,
            near: this.near,
            far: this.far,
            fovVertical: this.fovVertical,
            fovHNasal: this.fovHNasal,
            fovHTemporal: this.fovHTemporal,
            fovHorizontal: this.fovHorizontal,
            aspectRatio: this.aspectRatio,
            top: this.top,
            bottom: this.bottom,
            imgWidthNasal: this.imgWidthNasal,
            imgWidthTemporal: this.imgWidthTemporal,
            leftForLeftEye: this.leftForLeftEye,
            rightForLeftEye: this.rightForLeftEye,
            leftForRightEye: this.leftForRightEye,
            rightForRightEye: this.rightForRightEye,
        };
    }

    /**
     * Set a particular param value from the UI sliders.
     * - update the projection matrix and other values
     * - update the visual representation of the HMD
     * - notify observers that the values have been updated
     * @param key The key of the param to set.
     * @param value The value to set the param to.
     */
    public setParam(key: string, value: number) {
        this[key] = value;

        // need to recalculate the projection matrix and all the other values
        this.calcProjectionMatrix();

        // update camera projection matrices
        this.camL.freezeProjectionMatrix(this.projMatL);
        this.camR.freezeProjectionMatrix(this.projMatR);

        // update the eye positions
        this.eyePosL = this.pos.clone().add(new Vector3(-this.ipd / 2, 0, -this.distEye2Display));
        this.eyePosR = this.pos.clone().add(new Vector3(this.ipd / 2, 0, -this.distEye2Display));

        // update the eye mesh positions (these were relative to display)
        this.eyeL.position.z = -this.distEye2Display;
        this.eyeR.position.z = -this.distEye2Display;
        this.eyeL.position.x = -this.ipd / 2;
        this.eyeR.position.x = this.ipd / 2;

        // update the lens positions
        this.lensL.position.x = -this.ipd / 2;
        this.lensL.position.z = -this.distLens2Display;
        this.lensR.position.x = this.ipd / 2;
        this.lensR.position.z = -this.distLens2Display;

        // update the display size with affecting the children
        this.updateDisplaySize();

        // notify observers that the values have been updated
        this.notifyValuesUpdated();
    }

    /**
     * Update the display size without affecting the children.
     * - temporarily detach children, update the display size,
     *   and reattach children
     */
    private updateDisplaySize() {
        // get the current width and height of the display
        const boundingInfo = this.display.getBoundingInfo().boundingBox;
        const currWidth = boundingInfo.maximumWorld.x - boundingInfo.minimumWorld.x;
        const currHeight = boundingInfo.maximumWorld.y - boundingInfo.minimumWorld.y;
        
        // only update if the width or height has changed
        if (this.displayWidth === currWidth && this.displayHeight === currHeight) {
            return;
        }

        const scalingFactorX = this.displayWidth / currWidth;
        const scalingFactorY = this.displayHeight / currHeight;

        // detach children
        const children = this.display.getChildMeshes();
        children.forEach((child) => {
            child.setParent(null);
        });

        // update the display size
        this.display.scaling.x *= scalingFactorX;
        this.display.scaling.y *= scalingFactorY;
        
        // reattach children
        children.forEach((child) => {
            child.setParent(this.display);
        });
    }


    /**
     * Create a view matrix for the left lens of the HMD based on the IPD.
     * - use a lookat point in front of the lens as the target to create a rotation
     * @returns The view matrix for the left lens of the HMD.
     *
     * TODO: not sure why the lookat point needs to be behind the lens, 
     *       and the up vector needs to be down for the
     *       frustum to be rotated correctly after f > distLens2Display
     */
    get viewMatrixL() {
        const leftEyePos = this.pos.clone();
        leftEyePos.x -= this.ipd / 2;
        leftEyePos.z -= this.distEye2Display;
        const lookAtPoint = leftEyePos.clone();
        const up = Vector3.Up();
        lookAtPoint.z -= 1;
        return Matrix.LookAtLH(leftEyePos, lookAtPoint, up);
    }

    /**
     * Create a view matrix for the right lens of the HMD based on the IPD.
     * - use a lookat point in front of the lens as the target to create a rotation
     * @returns The view matrix for the right lens of the HMD.
     */
    get viewMatrixR() {
        const rightEyePos = this.pos.clone();
        rightEyePos.x += this.ipd / 2;
        rightEyePos.z -= this.distEye2Display;
        const lookAtPoint = rightEyePos.clone();
        const up = Vector3.Up();
        lookAtPoint.z -= 1;
        return Matrix.LookAtLH(rightEyePos, lookAtPoint, up);
    }

    /**
     * Create a new HMD with the given scene.
     * @param scene The scene to create the HMD in.
     */
    constructor(scene: Scene) {
        this.scene = scene;
        
        // setup the meshes for the HMD
        this.setupMeshes();
        
        // do first calculation of the projection matrix as it is needed
        // for the cameras
        this.calcProjectionMatrix();

        // setup the eye cameras
        this.camL = new FreeCamera("camL", this.eyePosL, scene);
        this.camR = new FreeCamera("camR", this.eyePosR, scene);

        // set the projection matrix for the cameras
        this.camL.freezeProjectionMatrix(this.projMatL);
        this.updateCamera2Eye(this.camL, true);
        this.camR.freezeProjectionMatrix(this.projMatR);
        this.updateCamera2Eye(this.camR, false);
    }

    /**
     * Create the meshes for the display, lenses (and eyes) of the HMD.
     * - the whole HMD is anchored at the position of the display
     * - we treat the eyes as part of the HMD
     */
    private setupMeshes() {
        this.display = MeshBuilder.CreateBox('display', 
            { width: this.displayWidth, height: this.displayHeight, depth: this.displayDepth }, this.scene);
        this.display.enableEdgesRendering();
        this.display.edgesWidth = 1;
        this.display.visibility = 0.3;
        this.display.edgesColor = new Color4(0.5, 0.5, 1, 1);
        this.display.position.copyFrom(this.pos); // this the anchor

        this.lensL = MeshBuilder.CreateCylinder('lensL',
            { diameter: this.lensDiameter, height: this.lensDepth, tessellation: 24 }, this.scene);
        this.lensL.rotation.x = Math.PI / 2;
        this.lensL.enableEdgesRendering();
        this.lensL.edgesWidth = 1;
        this.lensL.visibility = 0.3;
        this.lensL.edgesColor = new Color4(0.5, 0.5, 1, 1);
        this.lensL.parent = this.display;
        this.lensL.position.x -= this.ipd / 2;
        this.lensL.position.z -= this.distLens2Display;

        this.lensR = MeshBuilder.CreateCylinder('lensR',
            { diameter: this.lensDiameter, height: this.lensDepth, tessellation: 24 }, this.scene);
        this.lensR.rotation.x = Math.PI / 2;
        this.lensR.enableEdgesRendering();
        this.lensR.edgesWidth = 1;
        this.lensR.visibility = 0.3;
        this.lensR.edgesColor = new Color4(0.5, 0.5, 1, 1);
        this.lensR.parent = this.display;
        this.lensR.position.x += this.ipd / 2;
        this.lensR.position.z -= this.distLens2Display;

        this.eyeL = MeshBuilder.CreateSphere('eyeL',
            { diameter: this.eyeDiameter, segments: 16 }, this.scene);
        this.eyeL.visibility = 0.3;
        this.eyeL.edgesColor = new Color4(0.5, 0.5, 1, 1);
        this.eyeL.parent = this.display;
        this.eyeL.position.x -= this.ipd / 2;
        this.eyeL.position.z -= this.distEye2Display;

        this.eyeR = MeshBuilder.CreateSphere('eyeR',
            { diameter: this.eyeDiameter, segments: 16 }, this.scene);
        this.eyeR.visibility = 0.3;
        this.eyeR.edgesColor = new Color4(0.5, 0.5, 1, 1);
        this.eyeR.parent = this.display;
        this.eyeR.position.x += this.ipd / 2;
        this.eyeR.position.z -= this.distEye2Display;
    }

    /**
     * Calculate the projection matrix for the HMD for an eye.
     * Update the commented code above to work for either eye.
     * @param isLeftEye Whether the eye is the left eye.
     * @returns The projection matrix for the HMD.
     */
    public calcProjectionMatrix() {
        // update eye to display distance in case something changed
        // - TODO: this causes the frustum to increase when eyeRelief is increased which
        //  is not correct
        this.distEye2Display = this.eyeRelief + this.distLens2Display;

        // calculate magnification factor
        // - note that if f < distLens2Display, then it will be -ve
        // - else it will be +ve
        // - when f = distLens2Display, the magFactor will be infinite
        this.magnification = this.f / (this.f - this.distLens2Display);

        // calculate the full height of the virtual image for the particular eye
        this.imgHeight = this.displayHeight * this.magnification;

        // calculate the distance from the lens to the virtual image
        // - for HMD, the f needs to be > distLens2Display (or the object distance)
        // - this results in a -ve value for distLens2Img 
        //   which means the virtual image is on the same side as the object
        // - this is similar to a magnifying glass (as opposed to a projector)
        this.distLens2Img = 1 / (1 / this.f - 1 / this.distLens2Display);

        // calculate the distance from the eye to the virtual image
        // - make distLens2Img abs for calculations
        // - it is -ve in conceptual terms
        this.distEye2Img = Math.abs(this.distLens2Img) + this.eyeRelief;

        // calculate the near plane distance
        // - this should start at minimum the position of the display
        this.near = this.distEye2Display;

        // calculate the far plane distance
        // - this does not have to be exact, but should be far enough to encompass the scene
        // - for testing purposes, set it to be 5 units away from the near plane
        this.far = this.near + 8;

        // set params for setting a camera
        // - the fov is the vertical FOV
        // - the aspect ratio is the display's aspect ratio
        // - the near and far planes are set to the calculated values
        this.fovVertical = 2 * Math.atan((this.imgHeight / 2) / this.distEye2Img);
        this.fovHNasal = Math.atan((this.magnification * this.ipd / 2) / this.distEye2Img);
        this.fovHTemporal = Math.atan((this.magnification * (this.displayWidth - this.ipd) / 2) 
                            / this.distEye2Img);
        this.fovHorizontal = this.fovHNasal + this.fovHTemporal;

        // convert to degrees
        this.fovVertical = this.fovVertical * 180 / Math.PI;
        this.fovHorizontal = this.fovHorizontal * 180 / Math.PI;
        this.fovHNasal = this.fovHNasal * 180 / Math.PI;
        this.fovHTemporal = this.fovHTemporal * 180 / Math.PI;

        // calculate the left, right, top, and bottom values for the off-axis projection
        // - this was adapted from THREE.js's Matrix4.makePerspective function
        // - the built-in Babylon.js function does not allow for off-axis projection
        // - this is a manual calculation of the projection Matrix
        this.top = this.near * this.imgHeight / (2 * this.distEye2Img);
        this.bottom = -this.top;
        this.imgWidthNasal = this.magnification * this.ipd / 2;
        this.imgWidthTemporal = this.magnification * (this.displayWidth - this.ipd) / 2;
        
        // calculate the left and right values based on the eye
        this.rightForLeftEye = this.distEye2Display * this.imgWidthNasal / this.distEye2Img;
        this.leftForLeftEye = -this.distEye2Display * this.imgWidthTemporal / this.distEye2Img;
        this.rightForRightEye = this.distEye2Display * this.imgWidthTemporal / this.distEye2Img;
        this.leftForRightEye = -this.distEye2Display * this.imgWidthNasal / this.distEye2Img;

        // TODO: use PerspectiveLH to create the projection matrix with projectionPlaneTilt
        // - this is the off-axis projection matrix for the left eye
        // calculate the projectionPlaneTilt
        //const projectionPlaneTilt = Math.atan(this.distEye2Display / this.distEye2Img);
        //const projMatL = Matrix.PerspectiveLH(this.rightForLeftEye - this.leftForLeftEye,
            //this.top - this.bottom, this.near, this.far, false, );

        // do left eye calculations
        let x = 2 * this.near / (this.rightForLeftEye - this.leftForLeftEye);
        const y = 2 * this.near / (this.top - this.bottom);
        let a = (this.rightForLeftEye + this.leftForLeftEye) / (this.rightForLeftEye - this.leftForLeftEye);
        const b = (this.top + this.bottom) / (this.top - this.bottom);
        const c = -(this.far + this.near) / (this.far - this.near);
        const d = (-2 * this.far * this.near) / (this.far - this.near);
        // if ( coordinateSystem === WebGPUCoordinateSystem ) 
        //c = - far / ( far - near );
        //d = ( - far * near ) / ( far - near );
        this.projMatL = Matrix.FromValues(
            x, 0, 0, 0,
            0, y, 0, 0,
            a, b, c, -1,
            0, 0, d, 0
        );

        // now do right eye calculations
        x = 2 * this.near / (this.rightForRightEye - this.leftForRightEye);
        a = (this.rightForRightEye + this.leftForRightEye) / (this.rightForRightEye - this.leftForRightEye);
        this.projMatR = Matrix.FromValues(
            x, 0, 0, 0,
            0, y, 0, 0,
            a, b, c, -1,
            0, 0, d, 0
        );

        //if (DEBUG) {
            //console.log("----------------------------------");
            //console.log("HMD PARAMETERS");
            //console.log("ipd:", this.ipd);
            //console.log("eyeRelief:", this.eyeRelief);
            //console.log("f:", this.f);
            //console.log("distLens2Display:", this.distLens2Display);
            //console.log("distEye2Display:", this.distEye2Display);
            //console.log("displayWidth:", this.displayWidth);
            //console.log("displayHeight:", this.displayHeight);
            //console.log("aspectRatio:", this.aspectRatio);
            //console.log("----------------------------------");
            //console.log("CALCULATED OTHER VALUES");
            //console.log("magFactor:", magnification);
            //console.log("imgHeight:", imgHeight);
            //console.log("distLens2Img:", distLens2Img);
            //console.log("distEye2Img:", distEye2Img);
            //console.log("----------------------------------");
            //console.log("NEAR AND FAR PLANES");
            //console.log("near:", near);
            //console.log("far:", far);
            //console.log("----------------------------------");
            //console.log("PROJECTION MATRIX");
            //console.log(projMat);
            //console.log("----------------------------------");
        //}
    }

    /**
     * Update the HMD position and everything that depends on it.
     * Also update the mesh positions by updating the display position, since 
     * the display is the parent of the lenses and eyes.
     * @param newPos The new position to set the HMD to.
     */
    public updatePosition(newPos: Vector3) {
        this.pos.copyFrom(newPos);

        // Update the display position
        this.display.position.copyFrom(this.pos);

        // Update the eye positions
        this.eyePosL = this.pos.clone().add(new Vector3(-this.ipd / 2, 0, -this.distEye2Display));
        this.eyePosR = this.pos.clone().add(new Vector3(this.ipd / 2, 0, -this.distEye2Display));

        // Update the camera positions
        this.updateCamera2Eye(this.camL, true);
        this.updateCamera2Eye(this.camR, false);
    }

    /**
     * Update the eye position and target for the given camera.
     * @param camera The camera to update.
     * @param isLeftEye Whether the camera is the left eye.
     */
    private updateCamera2Eye(camera: FreeCamera, isLeftEye: boolean) {
        // update position
        const eyePosition = isLeftEye ? this.eyePosL : this.eyePosR;
        camera.position.copyFrom(eyePosition);

        // Override getViewMatrix to return the custom view matrix
        const viewMatrix = isLeftEye ? this.viewMatrixL : this.viewMatrixR;
        camera.getViewMatrix = function() {
            return viewMatrix;
        };
    }

    /**
     * Notify observers that the values have been updated.
     */
    onValuesUpdatedObservable = new Observable<void>();
    public notifyValuesUpdated() {
        this.onValuesUpdatedObservable.notifyObservers();
    }

    /**
     * Provide the rendered scene through the eye cameras.
     * - this will be used to render the scene in a PIP window in the UI
     * - app will call this to render in the UI
     * @param isLeftEye Whether to render the left eye.
     * @returns The rendered scene as a base64 image.
     * @see https://doc.babylonjs.com/divingDeeper/cameras/rendering_to_a_texture
     * @see https://doc.babylonjs.com/divingDeeper/cameras/advanced_camera_options
     */
    //public renderScene(isLeftEye: boolean): RenderTargetTexture {
        //// get the camera to render
        //const camera = isLeftEye ? this.camL : this.camR;

        ////// render the scene
        ////this.scene.renderToTarget(true, camera);

        ////// get the base64 image
        ////return this.scene.getEngine().getRenderingCanvas()?.toDataURL();
        
        //const renderTarget = new RenderTargetTexture(
            //"eyeRender",
            //{ width: 512, height: 512 },
            //this.scene,
            //false
        //);

        ////DEBUG test camera
        //const cam = new FreeCamera("cam", new Vector3(0, 0, 0), this.scene);
        //cam.position = new Vector3(0, 0, -10);

        //renderTarget.activeCamera = cam;
        //this.scene.customRenderTargets.push(renderTarget);
        //return renderTarget;
    //}
}
