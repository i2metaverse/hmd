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
} from "@babylonjs/core";

import { LAYER_HMD, LAYER_SCENE } from "./constants";

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
    distLens2Display = .39;
    displayWidth = 1.2096;
    displayHeight = .6803;
    displayDepth = .05;
    lensDiameter = .34;
    lensDepth = .05;
    eyeDiameter = .15;
    farFromNear = 10;

    // Calculated values
    distEye2Display!: number;
    magnification!: number;
    imgHeight!: number;
    distLens2Img!: number;
    distEye2Img!: number;
    near!: number;
    far!: number;
    aspectRatio!: number;
    fovVertical!: number;
    fovHNasal!: number;
    fovHTemporal!: number;
    fovHorizontal!: number;
    eyePosL!: Vector3;
    eyePosR!: Vector3;

    // Calculated values for the off-axis projection
    top!: number;
    bottom!: number;
    imgWidthNasal!: number;
    imgWidthTemporal!: number;
    rightForLeftEye!: number;
    leftForLeftEye!: number;
    rightForRightEye!: number;
    leftForRightEye!: number;

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

    // mesh for the virtual image
    private virtualImg!: Mesh;

    /**
     * Get the aspect ratio of an eye's view.
     * @returns The aspect ratio of an eye's view.
     */
    get aspectRatioEye() {
        return (this.rightForLeftEye - this.leftForLeftEye) / (this.top - this.bottom);
    }

    /**
     * Create a world transform matrix for the HMD.
     * @returns The world transform matrix for the HMD.
     */
    get transformMatrix() {
        return Matrix.Translation(this.pos.x, this.pos.y, this.pos.z);
    }

    /**
     * Create a view matrix for the left lens of the HMD based on the IPD.
     * @returns The view matrix for the left lens of the HMD.
     *
     */
    get viewMatrixL() {
        return this.getViewMatrix(true);
    }

    /**
     * Create a view matrix for the right lens of the HMD based on the IPD.
     * @returns The view matrix for the right lens of the HMD.
     */
    get viewMatrixR() {
        return this.getViewMatrix(false);
    }

    /*
     * Helper for the above getters of view matrices.
     * - use a lookat point straight in front of the lens as the target
     * @param isLeftEye Whether the eye is the left eye.
     * @returns The view matrix for the eye.
     */
    private getViewMatrix(isLeftEye: boolean) {
        const eyePos = isLeftEye ? this.eyePosL : this.eyePosR;
        const lookAtPoint = eyePos.clone().add(new Vector3(0, 0, 1)); 
        const up = Vector3.Up();
        const viewMat = Matrix.LookAtLH(eyePos, lookAtPoint, up);
        return viewMat;
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
        this.updateEyePos();

        // update the eye mesh positions (these were relative to display)
        this.eyeL.position.z = -this.distEye2Display;
        this.eyeR.position.z = -this.distEye2Display;
        this.eyeL.position.x = -this.ipd / 2;
        this.eyeR.position.x = this.ipd / 2;

        // update the lens positions
        this.lensL.position.z = -this.distLens2Display;
        this.lensR.position.z = -this.distLens2Display;
        this.lensL.position.x = -this.ipd / 2;
        this.lensR.position.x = this.ipd / 2;

        // update the display size with affecting the children
        this.updateDisplaySize();

        // notify observers that the values have been updated
        this.notifyValuesUpdated();

    }

    /**
     * Update the eye positions based on the IPD and eye relief.
     * - this is called when the IPD or eye relief is changed
     */
    private updateEyePos() {
        this.eyePosL = this.pos.clone().add(new Vector3(-this.ipd / 2, 0, -this.distEye2Display));
        this.eyePosR = this.pos.clone().add(new Vector3(this.ipd / 2, 0, -this.distEye2Display));
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
     * Create a new HMD with the given scene.
     * @param scene The scene to create the HMD in.
     */
    constructor(scene: Scene) {
        this.scene = scene;
        
        // do first calculation of the projection matrix as it is needed
        this.calcProjectionMatrix();
        
        // setup the meshes for the HMD
        this.setupMeshes();

        // update eye positions
        this.updateEyePos();

        // setup the eye cameras
        this.camL = new FreeCamera("camL", this.eyePosL, scene);
        this.camR = new FreeCamera("camR", this.eyePosR, scene);

        // set eye cameras to render only the scene
        this.camL.layerMask = LAYER_SCENE;
        this.camR.layerMask = LAYER_SCENE;

        // set the projection matrix for the cameras
        this.camL.freezeProjectionMatrix(this.projMatL);
        this.camR.freezeProjectionMatrix(this.projMatR);
        this.updateCamera2Eye(this.camL, true);
        this.updateCamera2Eye(this.camR, false);

        // set meshes layer mask to not be rendered in the HMD eye cameras
        this.display.layerMask = LAYER_HMD
        this.lensL.layerMask = LAYER_HMD;
        this.lensR.layerMask = LAYER_HMD;
        this.eyeL.layerMask = LAYER_HMD;
        this.eyeR.layerMask = LAYER_HMD;
        //this.virtualImg.layerMask = LAYER_HMD;
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

        //// create a virtual image mesh
        //const imgWidth = 2 * (this.imgWidthNasal + this.imgWidthTemporal);
        //this.virtualImg = MeshBuilder.CreatePlane('virtualImg',
            //{ width: imgWidth, height: this.imgHeight }, this.scene);
        ////this.virtualImg.enableEdgesRendering();
        ////this.virtualImg.edgesWidth = 1;
        //this.virtualImg.visibility = 0.1;
        //this.virtualImg.parent = this.display;
        //this.virtualImg.position.z = (this.distEye2Img - this.distEye2Display);
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
        // - make magnification abs for calculations
        this.magnification = Math.abs(this.f / (this.f - this.distLens2Display));

        // calculate the full height of the virtual image for the particular eye
        this.imgHeight = this.displayHeight * this.magnification;

        // aspect ratio just for display info
        this.aspectRatio = this.displayWidth / this.displayHeight;

        // calculate the distance from the lens to the virtual image
        // - for HMD, the f needs to be > distLens2Display (or the object distance)
        // - this results in a -ve value for distLens2Img 
        //   which means the virtual image is on the same side as the object
        // - this is similar to a magnifying glass (as opposed to a projector)
        // - make distLens2Img abs for calculations
        this.distLens2Img = Math.abs(1 / (1 / this.f - 1 / this.distLens2Display));

        // calculate the distance from the eye to the virtual image
        // - it is -ve in conceptual terms
        this.distEye2Img = this.distLens2Img + this.eyeRelief;

        // calculate the near plane distance
        // - this should start at minimum the position of the display
        this.near = this.distEye2Display;

        // calculate the far plane distance
        // - this does not have to be exact, but should be far enough to encompass the scene
        // - for testing purposes, set it to be 5 units away from the near plane
        this.far = this.near + this.farFromNear;

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

        ////////////////////////////////
        // Off-axis projection matrix //
        // This means we need to calculate the projection matrix manually due to the asymmetry
        // of the horizontal frustum for the left and right eyes.
        // The general form of the projection matrix for RHS in OpenGL is:
        // | 2n/(r-l)     0            0            0   |
        // | 0            2n/(t-b)     0            0   |
        // | (r+l)/(r-l)  (t+b)/(t-b)  -(f+n)/(f-n) -1  |
        // | 0            0            -2fn/(f-n)   0   |
        // HOWEVER and HOWEVER (yes this took me ages to debug)...
        // In Babylon.js, it is LHS axes, the the matrix becomes:
        // | 2n/(r-l)     0            0            0   |
        // | 0            2n/(t-b)     0            0   |
        // | (r+l)/(r-l)  (t+b)/(t-b)  (f+n)/(f-n)  1   |
        // | 0            0            -2fn/(f-n)   0   |
        // https://www.scratchapixel.com/lessons/3d-basic-rendering/perspective-and-orthographic-projection-matrix/opengl-perspective-projection-matrix.html
        // https://www.songho.ca/opengl/gl_transform.html#example2
        // The code is adapted from THREE.js's Matrix4.makePerspective function but with the
        // signs changed to match Babylon.js's LHS axes.

        // TODO: try to use PerspectiveLH to create the projection matrix with projectionPlaneTilt
        //       - calculate the projectionPlaneTilt
        //const projectionPlaneTilt = Math.atan(this.distEye2Display / this.distEye2Img);
        //const projMatL = Matrix.PerspectiveLH(this.rightForLeftEye - this.leftForLeftEye,
        //                 this.top - this.bottom, this.near, this.far, false);

        // do left eye calculations
        let x = 2 * this.near / (this.rightForLeftEye - this.leftForLeftEye);
        const y = 2 * this.near / (this.top - this.bottom);
        let a = (this.rightForLeftEye + this.leftForLeftEye) / (this.rightForLeftEye - this.leftForLeftEye);
        const b = (this.top + this.bottom) / (this.top - this.bottom);
        const c = (this.far + this.near) / (this.far - this.near);
        const d = (-2 * this.far * this.near) / (this.far - this.near);
        // if ( coordinateSystem === WebGPUCoordinateSystem ) 
        //     c = - far / ( far - near );
        //     d = ( - far * near ) / ( far - near );
        this.projMatL = Matrix.FromValues(
            x, 0, 0, 0,
            0, y, 0, 0,
            a, b, c, 1,
            0, 0, d, 0
        );

        // now do right eye calculations
        x = 2 * this.near / (this.rightForRightEye - this.leftForRightEye);
        a = (this.rightForRightEye + this.leftForRightEye) / (this.rightForRightEye - this.leftForRightEye);
        this.projMatR = Matrix.FromValues(
            x, 0, 0, 0,
            0, y, 0, 0,
            a, b, c, 1,
            0, 0, d, 0
        );
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
        this.updateEyePos();

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
}
