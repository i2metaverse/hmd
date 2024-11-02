/**
 * @file FrustumVisualizer class for visualizing the frustum of a camera.
 * @author Chek
 * @lastUpdated 28 Oct 2024
 */
import {
    Matrix,
    Mesh,
    MeshBuilder,
    Scene,
    Vector3,
    VertexBuffer,
} from "@babylonjs/core";

import { LAYER_FRUSTUM } from "./constants";

export class FrustumVisualizer {
    private frustumMesh: Mesh;
    private scene: Scene;

    /**
     * Builds a new FrustumVisualizer with projection and view matrices.
     * @param projMat The projection matrix to calculate the frustum corners for.
     * @param viewMat The view matrix to calculate the frustum corners for.
     * @param transformMat The transform matrix to calculate the frustum corners for.
     * @param scene The scene to add the frustum mesh to.
     */
    constructor(
        projMat: Matrix,
        viewMat: Matrix,
        transformMat: Matrix,
        scene: Scene
    ) {
        this.frustumMesh = this.createFrustumMesh(
            projMat,
            viewMat,
            transformMat,
            scene
        );
        this.scene = scene;

        // set the layer mask to not be rendered by the HMD eye cameras
        this.frustumMesh.layerMask = LAYER_FRUSTUM;
    }

    /**
     * Calculate the corners of the frustum in world space.
     * @param projMat The projection matrix to calculate the frustum corners for.
     * @param viewMat The view matrix to calculate the frustum corners for.
     * @param transformMat The transform matrix to calculate the frustum corners for.
     * @returns The corners of the frustum in local space.
     *
     * In a typical 3D graphics pipeline, the frustum is defined in clip space (NDC).
     * To get the corners of the frustum in world space, we need to transform the corners
     * from clip space to view space, and then from view space to world space.
     *
     * In the normal pipeline, for a given point P in the scene, the transformation is:
     * P_clip = projMat * viewMat * transformMat * P
     *
     * Given the clip space coords, to get back the original P in the scene, we need to
     * invert the above transformation:
     * P = invTransformMat * invViewMat * invProjMat * P_clip
     *
     * Here we are not getting a point P in the scene, but the corners of the frustum.
     * The corners of the frustum is always the extreme points of the frustum in clip space.
     *
     * Also, we are not getting the local coords, but the world coords, so we leave out the
     * invTransformMat in the calculation.
     * P_world = invViewMat * invProjMat * P_clip
     *
     * Note: clip space is the step before the perspective divide, where the
     * coordinates are in the range [-1, 1] in all dimensions. To perform the final step from
     * clip space to screen space, the coordinates are divided by the w component, then mapped
     * according to the viewport dimensions.
     *
     * TODO: remove transformMat when concepts are confirmed
     */
    private calculateFrustumCorners(
        projMat: Matrix,
        viewMat: Matrix,
        transformMat: Matrix
    ) {
        // Define corners in clip space (NDC)
        const clipCorners = [
            new Vector3(-1, 1, -1), // Top Left near
            new Vector3(1, 1, -1), // Top Right near
            new Vector3(-1, -1, -1), // Bottom Left near
            new Vector3(1, -1, -1), // Bottom Right near
            new Vector3(-1, 1, 1), // Top Left far
            new Vector3(1, 1, 1), // Top Right far
            new Vector3(-1, -1, 1), // Bottom Left far
            new Vector3(1, -1, 1), // Bottom Right far
        ];

        // calculate the inverse of the projection and view matrices
        const invProjMat = Matrix.Invert(projMat);
        const invViewMat = Matrix.Invert(viewMat);
        const invTransformMat = Matrix.Invert(transformMat);

        // transform the corners to world space
        return clipCorners.map((clipCorner) => {
            // transform corner coords from clip space to view space
            const viewCorner = Vector3.TransformCoordinates(
                clipCorner,
                invProjMat
            );

            // transform corner coords from view space to world space
            const worldCorner = Vector3.TransformCoordinates(
                viewCorner,
                invViewMat
            );

            // transform corner coords from world space to local space
            //const localCorner = Vector3.TransformCoordinates(
                //worldCorner,
                //invTransformMat
            //);

            // we are not interested in local space, so return world space
            return worldCorner;
        });
    }

    public updateOrCreateFrustum(
        projMat: Matrix,
        viewMat: Matrix,
        transformMat: Matrix
    ) {
        const corners = this.calculateFrustumCorners(
            projMat,
            viewMat,
            transformMat
        );

        const lines = [];
        lines.push(
            [corners[0], corners[1]],
            [corners[1], corners[3]],
            [corners[3], corners[2]],
            [corners[2], corners[0]],
            [corners[4], corners[5]],
            [corners[5], corners[7]],
            [corners[7], corners[6]],
            [corners[6], corners[4]],
            [corners[0], corners[4]],
            [corners[1], corners[5]],
            [corners[2], corners[6]],
            [corners[3], corners[7]]
        );

        if (!this.frustumMesh) {
            this.frustumMesh = MeshBuilder.CreateLineSystem(
                "frustum",
                { lines },
                this.scene
            );
        } else {
            const linesVertices = this.frustumMesh.getVerticesData(
                VertexBuffer.PositionKind
            );
            if (linesVertices) {
                let idx = 0;
                corners.forEach((corner) => {
                    linesVertices[idx++] = corner.x;
                    linesVertices[idx++] = corner.y;
                    linesVertices[idx++] = corner.z;
                });

                this.frustumMesh.setVerticesData(
                    VertexBuffer.PositionKind,
                    linesVertices
                );
            }
        }
    }

    // Create lines to represent the frustum box
    private createFrustumMesh( projMat: Matrix, viewMat: Matrix, transformMat: Matrix,
        scene: Scene
    ) {
        const corners = this.calculateFrustumCorners(
            projMat,
            viewMat,
            transformMat
        );

        const lines = [];

        // Connect near plane
        lines.push(
            [corners[0], corners[1]],
            [corners[1], corners[3]],
            [corners[3], corners[2]],
            [corners[2], corners[0]]
        );

        // Connect far plane
        lines.push(
            [corners[4], corners[5]],
            [corners[5], corners[7]],
            [corners[7], corners[6]],
            [corners[6], corners[4]]
        );

        // Connect near and far planes
        lines.push(
            [corners[0], corners[4]],
            [corners[1], corners[5]],
            [corners[2], corners[6]],
            [corners[3], corners[7]]
        );
        
        return MeshBuilder.CreateLineSystem("frustum", { lines }, scene);
    }

    public updateFrustumMesh(
        projMat: Matrix,
        viewMat: Matrix,
        transformMat: Matrix
    ) {
        // calculate new corners
        const corners = this.calculateFrustumCorners(
            projMat,
            viewMat,
            transformMat
        );

        // get current frustum lines
        const linesVertices = this.frustumMesh.getVerticesData("position");

        // Define the mapping of `linesVertices` indices to `corners` indices
        const indexMapping = [
            // near plane
            [0, 0],
            [3, 1],
            [6, 1],
            [9, 3],
            [12, 3],
            [15, 2],
            [18, 2],
            [21, 0],

            // far plane
            [24, 4],
            [27, 5],
            [30, 5],
            [33, 7],
            [36, 7],
            [39, 6],
            [42, 6],
            [45, 4],

            // near to far plane
            [48, 0],
            [51, 4],
            [54, 1],
            [57, 5],
            [60, 2],
            [63, 6],
            [66, 3],
            [69, 7],
        ];

        // Update frustum lines
        if (linesVertices) {
            indexMapping.forEach(([lineIndex, cornerIndex]) => {
                linesVertices[lineIndex] = corners[cornerIndex].x;
                linesVertices[lineIndex + 1] = corners[cornerIndex].y;
                linesVertices[lineIndex + 2] = corners[cornerIndex].z;
            });

            // Update the frustum mesh with the new lines
            this.frustumMesh.setVerticesData(
                VertexBuffer.PositionKind,
                linesVertices
            );
        }
    }

    /**
     * Set visibility of the frustum mesh.
     * @param isVisible The visibility of the frustum mesh.
     */
    public setVisibility(isVisible: boolean) {
        this.frustumMesh.isVisible = isVisible;
    }

    /**
     * Toggle the visibility of the frustum mesh.
     */
    public toggleVisibility() {
        this.frustumMesh.isVisible = !this.frustumMesh.isVisible;
    }
}
