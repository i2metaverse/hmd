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

  // billboarded text labels so it is unambiguous which element is which
  private accomLabel!: Mesh;
  private vergLabel!: Mesh;
  private disparityLabel!: Mesh;

  // materials (emissive colours updated per frame to reflect comfort)
  private gazeMat: StandardMaterial;
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

    // focus (accommodation) plane: fixed cyan reference where the eye must focus
    this.focusMat = new StandardMaterial("vacFocusMat", scene);
    this.focusMat.emissiveColor = new Color3(0.2, 0.8, 0.95);
    this.focusMat.disableLighting = true;
    this.focusMat.alpha = 0.16;
    this.focusMat.backFaceCulling = false;

    // gaze lines + vergence marker: colour reflects comfort
    this.gazeMat = new StandardMaterial("vacGazeMat", scene);
    this.gazeMat.emissiveColor = new Color3(0.25, 0.9, 0.4);
    this.gazeMat.disableLighting = true;

    // conflict bar: the depth gap between vergence and accommodation
    this.conflictMat = new StandardMaterial("vacConflictMat", scene);
    this.conflictMat.emissiveColor = new Color3(0.95, 0.3, 0.3);
    this.conflictMat.disableLighting = true;

    // where each gaze line crosses the focus plane (retinal disparity)
    this.disparityMat = new StandardMaterial("vacDisparityMat", scene);
    this.disparityMat.emissiveColor = new Color3(0.95, 0.4, 0.9);
    this.disparityMat.disableLighting = true;

    // focus plane mesh
    this.focusPlane = MeshBuilder.CreatePlane(
      "vacFocusPlane",
      { size: 0.5 },
      scene,
    );
    this.focusPlane.material = this.focusMat;

    // vergence target marker
    this.vergenceMarker = MeshBuilder.CreateSphere(
      "vacVergenceMarker",
      { diameter: 0.03, segments: 12 },
      scene,
    );
    this.vergenceMarker.material = this.gazeMat;

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

    // text labels (colours match the elements they annotate)
    this.accomLabel = this.makeLabel(
      "vacAccomLabel",
      "ACCOMMODATION (fixed focus)",
      "#33ccf2",
    );
    this.vergLabel = this.makeLabel(
      "vacVergLabel",
      "VERGENCE (gaze target)",
      "#ffd24a",
    );
    this.disparityLabel = this.makeLabel(
      "vacDisparityLabel",
      "retinal disparity",
      "#f266e6",
    );

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
   * Helper to create a camera-facing text label drawn onto a plane.
   * Used to annotate the accommodation / vergence / disparity elements so the
   * overlay reads clearly without needing a separate key.
   * @param name The mesh name.
   * @param text The label text.
   * @param color The text colour (CSS string).
   * @returns The created billboarded label mesh.
   */
  private makeLabel(name: string, text: string, color: string): Mesh {
    const font = "bold 76px sans-serif";
    const texH = 128;

    // measure the text first so the texture/plane fit it exactly (no clipping)
    const probe = new DynamicTexture("probe", 64, this.scene, false);
    const pctx = probe.getContext();
    pctx.font = font;
    const textW = Math.ceil(pctx.measureText(text).width);
    probe.dispose();
    const texW = textW + 48; // a little horizontal padding

    const dt = new DynamicTexture(
      name + "DT",
      { width: texW, height: texH },
      this.scene,
      false,
    );
    dt.hasAlpha = true;
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, texW, texH);
    dt.drawText(text, null, 96, font, color, "transparent");

    const mat = new StandardMaterial(name + "Mat", this.scene);
    mat.diffuseTexture = dt;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveTexture = dt;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;

    // plane sized to the texture aspect ratio so the text is never clipped
    const planeH = 0.045;
    const plane = MeshBuilder.CreatePlane(
      name,
      { width: planeH * (texW / texH), height: planeH },
      this.scene,
    );
    plane.material = mat;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
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
    const up = Vector3.Up();

    // the accommodation (focus) plane is fixed by the optics and is always drawn
    const focusCenter = eyeMid.add(fwd.scale(accommodationDist));
    this.focusPlane.position.copyFrom(focusCenter);
    this.focusPlane.lookAt(eyeMid);
    this.accomLabel.position.copyFrom(focusCenter.add(up.scale(0.3)));

    // without a target (no object in view) there is no defined vergence: hide
    // every vergence-dependent element, leaving only the locked focus plane.
    const hasTarget = vergenceDist !== null;
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

    // conflict bar: the on-axis gap between the focus plane and the vergence point
    this.updateTube(
      this.conflictBar,
      focusCenter,
      vergPoint,
      this.conflictRadius,
    );

    // position the vergence / disparity labels above the elements they annotate
    this.vergLabel.position.copyFrom(vergPoint.add(up.scale(0.06)));
    this.disparityLabel.position.copyFrom(
      crossL.add(crossR).scale(0.5).add(up.scale(0.05)),
    );

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
      this.vergLabel,
      this.disparityLabel,
    ]) {
      m.isVisible = visible;
    }
  }

  /**
   * Set visibility for all VAC meshes.
   * @param isVisible Whether the VAC overlay should be visible.
   */
  public setVisibility(isVisible: boolean) {
    this.isVisible = isVisible;
    for (const m of this.meshes()) m.isVisible = isVisible;
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
    // dispose label materials + their dynamic textures before the meshes
    for (const label of [this.accomLabel, this.vergLabel, this.disparityLabel]) {
      label.material?.dispose(false, true);
    }
    for (const m of this.meshes()) m.dispose();
    this.gazeMat.dispose();
    this.focusMat.dispose();
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
      this.gazeL,
      this.gazeR,
      this.conflictBar,
      this.accomLabel,
      this.vergLabel,
      this.disparityLabel,
    ];
  }
}
