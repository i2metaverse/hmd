/**
 * @file VacVisualizer class for visualizing the Vergence-Accommodation Conflict (VAC).
 * @author Adi
 *
 * The Vergence-Accommodation Conflict is a core source of visual fatigue in VR HMDs.
 * In the real world, the distance at which the two eyes converge (vergence) and the
 * distance at which each eye focuses its lens (accommodation) are always the same.
 *
 * In an HMD this coupling is broken:
 * - Accommodation distance is FIXED by the optics. The lens forms a virtual image of
 *   the display at a single optical distance (the HMD's distEye2Img), so the eye must
 *   always focus there regardless of scene content.
 * - Vergence distance is VARIABLE. Stereo disparity in the rendered image makes the
 *   eyes converge on wherever the fixated object appears in depth.
 *
 * The mismatch between the two (measured in dioptres, 1/m) is the conflict. Beyond
 * roughly +/-0.5 D it leaves the "zone of comfort" (Shibata et al. 2011) and causes
 * the discomfort documented by Hoffman et al. 2008.
 *
 * This visualizer draws, anchored to and oriented with the HMD:
 * - a fixed focus (accommodation) plane at distEye2Img where the eyes must focus,
 * - two gaze lines from the eyes converging on a fixated vergence target,
 * - markers where the gaze lines cross the focus plane (the retinal disparity),
 * - a conflict bar along the centreline spanning the gap between the two distances,
 * colour-coded by whether the conflict sits inside the zone of comfort.
 */

import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { LAYER_FRUSTUM, VAC_COMFORT_DIOPTRES } from "./constants";

/**
 * Summary of the VAC state for a given pair of distances.
 */
export interface VacStats {
  accommodationDist: number; // metres, fixed by optics
  vergenceDist: number; // metres, where the eyes converge
  accommodationDiopters: number; // 1 / accommodationDist
  vergenceDiopters: number; // 1 / vergenceDist
  conflictDiopters: number; // signed: vergence - accommodation
  inComfortZone: boolean; // |conflict| <= VAC_COMFORT_DIOPTRES
}

export class VacVisualizer {
  private scene: Scene;

  // tube meshes (2 points each), rebuilt in place every frame
  private gazeL!: Mesh;
  private gazeR!: Mesh;
  private conflictBar!: Mesh;

  // marker meshes (repositioned every frame)
  private focusPlane!: Mesh;
  private vergenceMarker!: Mesh;
  private disparityL!: Mesh;
  private disparityR!: Mesh;
  private disparityLabelAnchor!: Mesh;

  // Text labels annotate the world-space VAC elements. They are shown only when
  // a valid vergence target exists, so Scene mode does not leave stale labels
  // behind when the gaze ray misses.
  private labelTexture!: GUI.AdvancedDynamicTexture;
  private accomLabel!: GUI.TextBlock;
  private vergLabel!: Mesh;
  private disparityLabel!: GUI.TextBlock;

  // materials (emissive colours updated per frame to reflect comfort)
  private gazeMat: StandardMaterial;
  private vergenceMarkerMat: StandardMaterial;
  private focusMat: StandardMaterial;
  private conflictMat: StandardMaterial;
  private disparityMat: StandardMaterial;

  private gazeRadius = 0.0018;
  private conflictRadius = 0.004;
  private isVisible = true;

  /**
   * Compute the dioptric VAC stats for a pair of distances.
   * Static so the UI can show numbers without owning a visualizer instance.
   * @param accommodationDist The fixed eye-to-virtual-image distance (metres).
   * @param vergenceDist The distance the eyes are converging on (metres).
   * @returns The VAC stats including the signed conflict in dioptres.
   */
  static computeStats(
    accommodationDist: number,
    vergenceDist: number,
  ): VacStats {
    const accommodationDiopters = 1 / accommodationDist;
    const vergenceDiopters = 1 / vergenceDist;
    const conflictDiopters = vergenceDiopters - accommodationDiopters;
    return {
      accommodationDist,
      vergenceDist,
      accommodationDiopters,
      vergenceDiopters,
      conflictDiopters,
      inComfortZone: Math.abs(conflictDiopters) <= VAC_COMFORT_DIOPTRES,
    };
  }

  /**
   * Pick a colour for the gaze/vergence based on the magnitude of the conflict.
   * Green inside the comfort zone, amber just outside, red far outside.
   * @param conflictDiopters The signed conflict in dioptres.
   * @returns The colour to apply to the comfort-dependent meshes.
   */
  private static comfortColor(conflictDiopters: number): Color3 {
    const mag = Math.abs(conflictDiopters);
    if (mag <= VAC_COMFORT_DIOPTRES) return new Color3(0.25, 0.9, 0.4); // green
    if (mag <= 2 * VAC_COMFORT_DIOPTRES) return new Color3(0.95, 0.75, 0.2); // amber
    return new Color3(0.95, 0.3, 0.3); // red
  }

  /**
   * Construct the VAC visualizer meshes and materials.
   * @param scene The Babylon.js scene to attach meshes and materials to.
   */
  constructor(scene: Scene) {
    this.scene = scene;
    this.scene.setRenderingAutoClearDepthStencil(3, true, true, true);
    this.labelTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      "vacLabelUi",
      true,
      scene,
    );

    // focus/accommodation reference: a soft optical surface where the eye focuses
    this.focusMat = new StandardMaterial("vacFocusMat", scene);
    this.focusMat.emissiveColor = new Color3(0.55, 0.86, 0.95);
    this.focusMat.diffuseColor = new Color3(0.12, 0.28, 0.34);
    this.focusMat.disableLighting = true;
    this.focusMat.alpha = 0.72;
    this.focusMat.backFaceCulling = false;
    this.focusMat.opacityTexture = this.makeFocusFadeTexture(scene);

    // gaze lines + vergence marker: colour reflects comfort
    this.gazeMat = new StandardMaterial("vacGazeMat", scene);
    this.gazeMat.emissiveColor = new Color3(0.25, 0.9, 0.4);
    this.gazeMat.disableLighting = true;

    // vergence target marker: matched to the label, while gaze rays retain
    // comfort-state colouring.
    this.vergenceMarkerMat = new StandardMaterial("vacVergenceMarkerMat", scene);
    this.vergenceMarkerMat.emissiveColor = new Color3(1, 0.82, 0.29);
    this.vergenceMarkerMat.diffuseColor = new Color3(0.62, 0.43, 0.08);
    this.vergenceMarkerMat.disableLighting = true;

    // conflict bar: the depth gap between vergence and accommodation
    this.conflictMat = new StandardMaterial("vacConflictMat", scene);
    this.conflictMat.emissiveColor = new Color3(0.95, 0.3, 0.3);
    this.conflictMat.disableLighting = true;

    // where each gaze line crosses the focus plane (retinal disparity)
    this.disparityMat = new StandardMaterial("vacDisparityMat", scene);
    this.disparityMat.emissiveColor = new Color3(0.86, 0.58, 1);
    this.disparityMat.diffuseColor = new Color3(0.42, 0.18, 0.58);
    this.disparityMat.disableLighting = true;

    // fixed-focus optical element. A soft disc reads more like an HMD optical
    // surface than a hard debugging clipping plane.
    this.focusPlane = MeshBuilder.CreateDisc(
      "vacFocusPlane",
      { radius: 0.26, tessellation: 64 },
      scene,
    );
    this.focusPlane.material = this.focusMat;
    this.focusPlane.isPickable = false;

    // vergence target marker
    this.vergenceMarker = MeshBuilder.CreateSphere(
      "vacVergenceMarker",
      { diameter: 0.03, segments: 12 },
      scene,
    );
    this.vergenceMarker.material = this.vergenceMarkerMat;

    // disparity markers on the focus plane
    this.disparityL = MeshBuilder.CreateSphere(
      "vacDisparityL",
      { diameter: 0.016, segments: 10 },
      scene,
    );
    this.disparityL.material = this.disparityMat;
    this.disparityR = MeshBuilder.CreateSphere(
      "vacDisparityR",
      { diameter: 0.016, segments: 10 },
      scene,
    );
    this.disparityR.material = this.disparityMat;
    this.disparityLabelAnchor = MeshBuilder.CreateSphere(
      "vacDisparityLabelAnchor",
      { diameter: 0.001, segments: 4 },
      scene,
    );
    this.disparityLabelAnchor.visibility = 0;
    this.disparityLabelAnchor.isPickable = false;

    // text labels (colours match the elements they annotate)
    this.accomLabel = this.makeLabel(
      "vacAccomLabel",
      "ACCOMMODATION",
      "#b8f3ff",
      18,
    );
    this.accomLabel.linkWithMesh(this.focusPlane);
    this.accomLabel.linkOffsetY = -62;
    this.vergLabel = this.makeWorldLabel(
      "vacVergLabel",
      "VERGENCE",
      "#ffd24a",
    );
    this.disparityLabel = this.makeLabel(
      "vacDisparityLabel",
      "RETINAL DISPARITY",
      "#dc94ff",
      10,
    );
    this.disparityLabel.linkWithMesh(this.disparityLabelAnchor);
    this.disparityLabel.linkOffsetX = 20;
    this.disparityLabel.linkOffsetY = 76;

    // gaze + conflict tubes (initial placeholder geometry, rebuilt on update)
    const o = Vector3.Zero();
    const z = new Vector3(0, 0, 1);
    this.gazeL = this.makeTube("vacGazeL", o, z, this.gazeRadius, this.gazeMat);
    this.gazeR = this.makeTube("vacGazeR", o, z, this.gazeRadius, this.gazeMat);
    this.conflictBar = this.makeTube(
      "vacConflictBar",
      o,
      z,
      this.conflictRadius,
      this.conflictMat,
    );

    this.setLayerMask(LAYER_FRUSTUM);
    this.setLabelsVisible(false);
    this.setVisibility(true);
  }

  /**
   * Helper to create an updatable tube between two points.
   * @param name The mesh name.
   * @param a The start point.
   * @param b The end point.
   * @param radius The tube radius.
   * @param mat The material to assign.
   * @returns The created tube mesh.
   */
  private makeTube(
    name: string,
    a: Vector3,
    b: Vector3,
    radius: number,
    mat: StandardMaterial,
  ): Mesh {
    const tube = MeshBuilder.CreateTube(
      name,
      { path: [a, b], radius, updatable: true, tessellation: 8 },
      this.scene,
    );
    tube.material = mat;
    tube.isPickable = false;
    return tube;
  }

  /**
   * Create an alpha texture for the accommodation disc. The center stays clear,
   * while the sides and rim fall away smoothly so the surface reads as a soft
   * optical component rather than a flat overlay.
   * @param scene The scene that owns the dynamic texture.
   * @returns A radial alpha texture for the focus plane material.
   */
  private makeFocusFadeTexture(scene: Scene): DynamicTexture {
    const size = 256;
    const texture = new DynamicTexture(
      "vacFocusFadeTexture",
      { width: size, height: size },
      scene,
      false,
    );
    texture.hasAlpha = true;

    const ctx = texture.getContext();
    ctx.clearRect(0, 0, size, size);
    const image = ctx.getImageData(0, 0, size, size);
    const smoothstep = (edge0: number, edge1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = (x / (size - 1)) * 2 - 1;
        const ny = (y / (size - 1)) * 2 - 1;
        const radial = Math.sqrt(nx * nx + ny * ny);
        const sideFade = 1 - smoothstep(0.18, 1, Math.abs(nx));
        const rimFade = 1 - smoothstep(0.62, 1, radial);
        const verticalSoftening = 0.84 + 0.16 * (1 - smoothstep(0, 1, Math.abs(ny)));
        const centerLift = 0.2 + 0.8 * (1 - smoothstep(0, 0.52, radial));
        const alpha = Math.max(
          0,
          Math.min(1, sideFade * rimFade * verticalSoftening * centerLift),
        );
        const i = (y * size + x) * 4;
        image.data[i] = 255;
        image.data[i + 1] = 255;
        image.data[i + 2] = 255;
        image.data[i + 3] = Math.round(alpha * 255);
      }
    }

    ctx.putImageData(image, 0, 0);
    texture.update(false);

    return texture;
  }

  /**
   * Helper to create a screen-space text label linked to a world-space mesh.
   * Used to annotate the accommodation / vergence / disparity elements so the
   * overlay reads clearly without needing a separate key.
   * @param name The GUI control name.
   * @param text The label text.
   * @param color The text colour (CSS string).
   * @param fontSize The screen-space font size in pixels.
   * @returns The created GUI text label.
   */
  private makeLabel(
    name: string,
    text: string,
    color: string,
    fontSize: number,
  ): GUI.TextBlock {
    const label = new GUI.TextBlock(name, text);
    label.color = color;
    label.fontFamily = "sans-serif";
    label.fontSizeInPixels = fontSize;
    label.fontWeight = "bold";
    label.outlineColor = "#1b1b1b";
    label.outlineWidth = 2;
    label.resizeToFit = true;
    label.textWrapping = false;
    label.isPointerBlocker = false;
    this.labelTexture.addControl(label);
    return label;
  }

  /**
   * Helper to create a camera-facing world-space label. Used for the vergence
   * target because it needs to sit directly by the 3D marker.
   * @param name The mesh name.
   * @param text The label text.
   * @param color The text colour (CSS string).
   * @returns The created billboarded label mesh.
   */
  private makeWorldLabel(name: string, text: string, color: string): Mesh {
    const font = "bold 76px sans-serif";
    const texH = 128;
    const probe = new DynamicTexture("probe", 64, this.scene, false);
    const pctx = probe.getContext();
    pctx.font = font;
    const textW = Math.ceil(pctx.measureText(text).width);
    probe.dispose();
    const texW = textW + 48;

    const dt = new DynamicTexture(
      name + "DT",
      { width: texW, height: texH },
      this.scene,
      false,
    );
    dt.hasAlpha = true;
    dt.drawText(text, null, Math.round(texH * 0.75), font, color, "transparent");

    const mat = new StandardMaterial(name + "Mat", this.scene);
    mat.diffuseTexture = dt;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveTexture = dt;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.disableDepthWrite = true;
    mat.backFaceCulling = false;

    const planeH = 0.045;
    const plane = MeshBuilder.CreatePlane(
      name,
      { width: planeH * (texW / texH), height: planeH },
      this.scene,
    );
    plane.material = mat;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.alwaysSelectAsActiveMesh = true;
    plane.renderingGroupId = 3;
    plane.isPickable = false;
    return plane;
  }

  /**
   * Helper to update an existing tube's endpoints in place.
   * @param tube The tube mesh to update.
   * @param a The new start point.
   * @param b The new end point.
   * @param radius The tube radius.
   */
  private updateTube(tube: Mesh, a: Vector3, b: Vector3, radius: number) {
    MeshBuilder.CreateTube(
      tube.name,
      { path: [a, b], radius, instance: tube, updatable: true, tessellation: 8 },
      this.scene,
    );
  }

  /**
   * Rebuild the VAC geometry for the current HMD pose and viewing state.
   *
   * The eyes lie in a common plane perpendicular to `forward`, so a gaze line from an
   * eye to the on-axis vergence target advances `vergenceDist` in forward-depth over
   * its full length. The fraction reaching the focus plane is therefore simply
   * accommodationDist / vergenceDist, which gives the focus-plane crossing points.
   *
   * @param eyeL World-space position of the left eye.
   * @param eyeR World-space position of the right eye.
   * @param forward The HMD forward direction (need not be normalized).
   * @param accommodationDist Fixed eye-to-virtual-image distance (metres).
   * @param vergenceDist Distance to the fixated vergence target (metres), or
   *   null when there is no target (Scene mode looking at empty space) — only the
   *   fixed accommodation plane is then drawn.
   */
  public update(
    eyeL: Vector3,
    eyeR: Vector3,
    forward: Vector3,
    accommodationDist: number,
    vergenceDist: number | null,
  ) {
    if (!this.isVisible) return;

    const fwd = forward.normalizeToNew();
    const eyeMid = eyeL.add(eyeR).scale(0.5);
    const worldUp = Vector3.Up();

    // the accommodation (focus) plane is fixed by the optics and is always drawn
    const focusCenter = eyeMid.add(fwd.scale(accommodationDist));
    this.focusPlane.position.copyFrom(focusCenter);
    this.focusPlane.lookAt(eyeMid);

    // without a target (no object in view) there is no defined vergence: hide
    // the 3D VAC overlay. The text readout still reports that focus is locked.
    const hasTarget = vergenceDist !== null;
    this.focusPlane.isVisible = hasTarget;
    this.setTargetVisible(hasTarget);
    if (!hasTarget) return;

    const vergPoint = eyeMid.add(fwd.scale(vergenceDist));

    // gaze lines from each eye to the converged target
    this.updateTube(this.gazeL, eyeL, vergPoint, this.gazeRadius);
    this.updateTube(this.gazeR, eyeR, vergPoint, this.gazeRadius);
    this.vergenceMarker.position.copyFrom(vergPoint);

    // where each line of sight crosses the focus plane (retinal disparity)
    const t = accommodationDist / vergenceDist;
    const crossL = eyeL.add(vergPoint.subtract(eyeL).scale(t));
    const crossR = eyeR.add(vergPoint.subtract(eyeR).scale(t));
    this.disparityL.position.copyFrom(crossL);
    this.disparityR.position.copyFrom(crossR);
    this.disparityLabelAnchor.position.copyFrom(crossL.add(crossR).scale(0.5));

    // conflict bar: the on-axis gap between the focus plane and the vergence point
    this.updateTube(
      this.conflictBar,
      focusCenter,
      vergPoint,
      this.conflictRadius,
    );
    this.vergLabel.position.copyFrom(vergPoint.add(worldUp.scale(0.08)));

    // colour the comfort-dependent meshes
    const stats = VacVisualizer.computeStats(accommodationDist, vergenceDist);
    const color = VacVisualizer.comfortColor(stats.conflictDiopters);
    this.gazeMat.emissiveColor = color;
  }

  /**
   * Show or hide the vergence-dependent meshes (everything except the fixed
   * accommodation plane and its label). Used when there is no target in view.
   * @param visible Whether the vergence-dependent meshes should be shown.
   */
  private setTargetVisible(visible: boolean) {
    for (const m of [
      this.gazeL,
      this.gazeR,
      this.vergenceMarker,
      this.conflictBar,
      this.disparityL,
      this.disparityR,
      this.disparityLabelAnchor,
    ]) {
      m.isVisible = visible;
    }
    this.setLabelsVisible(visible);
  }

  /**
   * Show or hide all world-space label planes. Kept centralized so the labels
   * remain available without reintroducing the fragile rendered-text overlay.
   * @param visible Whether the 3D text labels should be visible.
   */
  private setLabelsVisible(visible: boolean) {
    for (const label of [this.accomLabel, this.disparityLabel]) {
      label.isVisible = visible;
    }
    this.vergLabel.isVisible = visible;
  }

  /**
   * Set visibility for all VAC meshes.
   * @param isVisible Whether the VAC overlay should be visible.
   */
  public setVisibility(isVisible: boolean) {
    this.isVisible = isVisible;
    for (const m of this.meshes()) m.isVisible = isVisible;
    this.setLabelsVisible(isVisible);
  }

  /**
   * Toggle visibility of the VAC overlay.
   * @returns The new visibility state.
   */
  public toggleVisibility(): boolean {
    this.setVisibility(!this.isVisible);
    return this.isVisible;
  }

  /**
   * Assign a layer mask to all VAC meshes (kept off the HMD eye cameras).
   * @param mask The layer mask to apply.
   */
  public setLayerMask(mask: number) {
    for (const m of this.meshes()) m.layerMask = mask;
  }

  /**
   * Dispose all VAC meshes and materials.
   */
  public dispose() {
    this.vergLabel.material?.dispose(false, true);
    this.labelTexture.dispose();
    for (const m of this.meshes()) m.dispose();
    this.gazeMat.dispose();
    this.vergenceMarkerMat.dispose();
    this.focusMat.dispose(false, true);
    this.conflictMat.dispose();
    this.disparityMat.dispose();
  }

  /**
   * Helper to list every mesh owned by the visualizer.
   * @returns The array of VAC meshes.
   */
  private meshes(): Mesh[] {
    return [
      this.focusPlane,
      this.vergenceMarker,
      this.disparityL,
      this.disparityR,
      this.disparityLabelAnchor,
      this.gazeL,
      this.gazeR,
      this.conflictBar,
      this.vergLabel,
    ];
  }
}
