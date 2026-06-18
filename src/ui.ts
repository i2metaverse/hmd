/** 
 * @File This is the UI "layer".
 * @author Chek
 *
 * This file contains the UI class that creates the user interface for the application.
 * It uses the Babylon.js GUI library.
 *
 * The UI includes:
 * - sliders to control the HMD parameters
 * - text blocks to display the HMD parameters and calculated values
 * - buttons to toggle the frustum visualizers and PIP viewports
 */
import { EventState, Scene, VirtualJoystick } from '@babylonjs/core';
import * as GUI from "@babylonjs/gui";
import { HMD } from './hmd';
import {
    LAYER_UI,
    VIEWPORT_BORDER_THICKNESS,
    DisplayMode,
    VacMode,
    VERGENCE_DIST_MIN,
    VERGENCE_DIST_MAX,
} from './constants';
import { App } from './app';
import { VacVisualizer } from './vacVisualizer';
/**
 * The UI class to add UI controls to the scene.
 */
export class UI {
    // set PIP viewport GUI to be global as we need to update it when the window is resized
    private pipViewPortBorderL!: GUI.Rectangle;
    private pipViewPortBorderR!: GUI.Rectangle;

    // VR centre line
    private vrCenterMarker!: GUI.Rectangle;

    // Loading indicator
    private loadingContainer!: GUI.Container;
    private loadingText!: GUI.TextBlock;
    private advancedTexture!: GUI.AdvancedDynamicTexture;

    /**
     * Create a new UI object.
     * @param hmd The HMD object to control.
     * @param scene The scene to manipulate when callbacks are triggered.
     */
    constructor(hmd: HMD, scene: Scene, app: App) {
        // create a GUI
        this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');

        // set layerMask so that we prevent it from being rendered by the HMD cameras
        if (this.advancedTexture.layer) {
            this.advancedTexture.layer.layerMask = LAYER_UI;
        }

        // Create loading indicator (hidden by default)
        this.createLoadingIndicator();

        // create a stack panel to hold the controls
        const userPanel = new GUI.StackPanel();
        userPanel.width = '220px';
        userPanel.fontSize = '14px';
        userPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        userPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.advancedTexture.addControl(userPanel);

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
                    app.updateHMDEyeCameraViewports();
                });

                const textBlock = new GUI.TextBlock();
                textBlock.text = `${key}: ${slider.value.toFixed(3)}`;
                textBlock.height = '20px';
                textBlock.color = 'white';
                textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

                // update the text block when the slider changes
                slider.onValueChangedObservable.add(() => {
                    textBlock.text = `${key}: ${slider.value.toFixed(3)}`;
                });

                // add the text block and slider to the stack panel
                userPanel.addControl(textBlock);
                userPanel.addControl(slider);
            }
        }

        // Manual-mode vergence distance slider: places a hypothetical fixation
        // target at a chosen distance so the learner can sweep the VAC. Only
        // meaningful in Manual mode, so it lives in its own panel that is hidden
        // in Scene mode (where the real object sets the vergence distance).
        const vergencePanel = new GUI.StackPanel();
        vergencePanel.height = '40px';
        vergencePanel.isVisible = app.vacMode === VacMode.Manual;
        const vergenceLabel = new GUI.TextBlock();
        vergenceLabel.text = `vergenceDist: ${app.vergenceDist.toFixed(3)}`;
        vergenceLabel.height = '20px';
        vergenceLabel.color = '#ffd24a'; // gold, matching the VERGENCE overlay label
        vergenceLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        const vergenceSlider = new GUI.Slider();
        vergenceSlider.minimum = VERGENCE_DIST_MIN;
        vergenceSlider.maximum = VERGENCE_DIST_MAX;
        vergenceSlider.value = app.vergenceDist;
        vergenceSlider.height = '20px';
        vergenceSlider.width = '200px';
        vergenceSlider.color = '#e0a82a';
        vergenceSlider.background = 'white';
        vergenceSlider.onValueChangedObservable.add((value) => {
            app.setVergenceDist(value);
            vergenceLabel.text = `vergenceDist: ${value.toFixed(3)}`;
            refreshVacStats();
        });
        vergencePanel.addControl(vergenceLabel);
        vergencePanel.addControl(vergenceSlider);
        userPanel.addControl(vergencePanel);

        // create a list of text blocks to show all the HMD params and calculated values
        // - make them tiny and packed so they don't take up much space
        // - place them on the left of the screen
        const statsPanel = new GUI.StackPanel();
        statsPanel.width = '220px';
        statsPanel.fontSize = '12px';
        statsPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        statsPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.advancedTexture.addControl(statsPanel);

        // reduce the line space between the text blocks
        statsPanel.paddingBottom = '20px';
        statsPanel.paddingLeft = '20px';

        let displayCalculatedVals = hmd.displayCalculatedVals;
        for (const key in displayCalculatedVals) {
            if (displayCalculatedVals.hasOwnProperty(key)) {
                const textBlock = new GUI.TextBlock();
                const typedKey = key as keyof typeof displayCalculatedVals;
                const value = displayCalculatedVals[typedKey];

                // Ensure the value is numeric before using .toFixed(3)
                if (typeof value === 'number') {
                    textBlock.text = `${key}: ${value.toFixed(3)}`;
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

                    // Ensure the value is numeric before using .toFixed(3)
                    const value = displayCalculatedVals[typedKey];
                    if (typeof value === 'number') {
                        textBlock.text = `${key}: ${value.toFixed(3)}`;
                    } else {
                        textBlock.text = `${key}: ${value}`;
                    }
                });
            }
        }

        // Fixed hardware parameters (greyish-yellow)
        const fixedParams = hmd.displayFixedParams;
        for (const key in fixedParams) {
            if (fixedParams.hasOwnProperty(key)) {
                const textBlock = new GUI.TextBlock();
                const typedKey = key as keyof typeof fixedParams;
                const value = fixedParams[typedKey];
                textBlock.text = `${key}: ${value}`;
                textBlock.height = '12px';
                textBlock.color = '#AAAA66'; // greyish-yellow
                textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                statsPanel.addControl(textBlock);
            }
        }

        // VAC (vergence-accommodation conflict) readout: accommodation is fixed by
        // the optics, vergence is user-driven, and the dioptric difference is the
        // conflict. Colour flips when the conflict leaves the zone of comfort.
        const vacTitle = new GUI.TextBlock();
        vacTitle.text = '-- VAC --';
        vacTitle.height = '14px';
        vacTitle.color = '#7fe9ff';
        vacTitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        statsPanel.addControl(vacTitle);

        const vacModeBlock = new GUI.TextBlock();
        const vacAccomBlock = new GUI.TextBlock();
        const vacVergBlock = new GUI.TextBlock();
        const vacConflictBlock = new GUI.TextBlock();
        for (const block of [vacModeBlock, vacAccomBlock, vacVergBlock, vacConflictBlock]) {
            block.height = '12px';
            block.color = '#7fe9ff';
            block.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            statsPanel.addControl(block);
        }
        // colour-code the two halves of the conflict to match the 3D overlay
        vacAccomBlock.color = '#33ccf2'; // cyan = accommodation
        vacVergBlock.color = '#ffd24a';  // gold = vergence

        const vacModeName = (m: VacMode) =>
            m === VacMode.Off ? 'off'
                : m === VacMode.Scene ? 'scene object' : 'manual slider';

        // refresh the VAC readout from the current optics + active vergence distance
        function refreshVacStats() {
            const vergDist = app.getActiveVergenceDist();
            vacModeBlock.text = `mode: ${vacModeName(app.vacMode)}`;
            if (app.vacMode === VacMode.Off) {
                vacAccomBlock.text = 'accommodation: --';
                vacVergBlock.text = 'vergence: --';
                vacConflictBlock.text = 'conflict: --';
                vacConflictBlock.color = '#9fb4bb';
                return;
            }
            vacAccomBlock.text =
                `accommodation: ${hmd.distEye2Img.toFixed(2)}m (${(1 / hmd.distEye2Img).toFixed(2)}D)`;

            // no object in view (Scene looking at empty space): only the
            // fixed accommodation is defined, so report the vergence as absent
            if (vergDist === null) {
                vacVergBlock.text = 'vergence: no object in view';
                vacConflictBlock.text = 'conflict: -- (focus locked)';
                vacConflictBlock.color = '#9fb4bb';
                return;
            }

            const stats = VacVisualizer.computeStats(hmd.distEye2Img, vergDist);
            vacVergBlock.text =
                `vergence: ${stats.vergenceDist.toFixed(2)}m (${stats.vergenceDiopters.toFixed(2)}D)`;
            const sign = stats.conflictDiopters >= 0 ? '+' : '';
            const zone = stats.inComfortZone ? 'comfortable' : 'CONFLICT';
            vacConflictBlock.text =
                `conflict: ${sign}${stats.conflictDiopters.toFixed(2)}D (${zone})`;
            vacConflictBlock.color = stats.inComfortZone ? '#69e07a' : '#f06464';
        }
        refreshVacStats();

        // the vergence distance changes as the HMD/objects move in Scene mode,
        // so keep the readout live every frame
        scene.onBeforeRenderObservable.add(() => refreshVacStats());

        // create a rectangle to represent the VR centre lines
        this.vrCenterMarker = new GUI.Rectangle("vrCenterMarker");
        this.vrCenterMarker.width = "2px";
        this.vrCenterMarker.height = "70px";
        this.vrCenterMarker.thickness = 0;
        this.vrCenterMarker.background = "pink";
        this.vrCenterMarker.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.vrCenterMarker.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.vrCenterMarker.top = "-98px"; // adjust if needed
        this.vrCenterMarker.isVisible = false; // hidden by default
        this.advancedTexture.addControl(this.vrCenterMarker);

        // Create a horizontal StackPanel to hold both buttons side by side
        const buttonPanel = new GUI.StackPanel();
        buttonPanel.isVertical = false; // Set to horizontal layout
        buttonPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

        // create display mode toggle button
        let currentMode = DisplayMode.Simulation;
        let toggleVRButton!: GUI.Button;
        toggleVRButton = this.createToggleButton("VR", "#008080", () => {
            currentMode = currentMode === DisplayMode.Simulation 
                                          ? DisplayMode.VR 
                                          : DisplayMode.Simulation;
            app.setDisplayMode(currentMode);
            
            // update the viewports
            app.updateHMDEyeCameraViewports();

            // also update the VR centre line visibility
            this.vrCenterMarker.isVisible = app.currDisplayMode === DisplayMode.VR;
        });
        buttonPanel.addControl(toggleVRButton);

        // Single frustum state toggler. The frustums start visible, so the
        // initial label reflects the current scene instead of forcing a side.
        type FrustumState = 'left' | 'right' | 'both' | 'none';
        const FRUSTUM_CYCLE: FrustumState[] = ['left', 'right', 'both', 'none'];
        let frustumState: FrustumState = 'both';
        const frustumButtonText = (state: FrustumState) => `Frustum: ${state}`;
        const applyFrustumState = (state: FrustumState) => {
            app.frustumVisualizerL?.setVisibility(state === 'left' || state === 'both');
            app.frustumVisualizerR?.setVisibility(state === 'right' || state === 'both');
        };
        const frustumButton = this.createToggleButton(
            frustumButtonText(frustumState),
            '#5b4a91',
            () => {
                frustumState =
                    FRUSTUM_CYCLE[(FRUSTUM_CYCLE.indexOf(frustumState) + 1) % FRUSTUM_CYCLE.length];
                applyFrustumState(frustumState);
                const label = frustumButton.children?.[0] as GUI.TextBlock | undefined;
                if (label) label.text = frustumButtonText(frustumState);
                hmd.debugPrintPositions();
            },
        );
        frustumButton.width = '120px';
        buttonPanel.addControl(frustumButton);

        // Single VAC toggle cycling Off -> Scene -> Manual. Scene follows the
        // looked-at object; Manual shows the slider for direct vergence control.
        const primitiveVacCycle = [VacMode.Off, VacMode.Scene, VacMode.Manual];
        const splatVacCycle = [VacMode.Off, VacMode.Manual];
        const activeVacCycle = () =>
            app.isGaussianSplatEnvironment() ? splatVacCycle : primitiveVacCycle;
        const vacButtonText = (m: VacMode) =>
            `VAC: ${m === VacMode.Off ? 'off'
                : m === VacMode.Scene ? 'scene' : 'manual'}`;
        const refreshVacControls = () => {
            vergencePanel.isVisible = app.vacMode === VacMode.Manual;
            const label = vacModeButton.children?.[0] as GUI.TextBlock | undefined;
            if (label) label.text = vacButtonText(app.vacMode);
            refreshVacStats();
        };
        const vacModeButton = this.createToggleButton(
            vacButtonText(app.vacMode),
            '#007a8a',
            () => {
                const cycle = activeVacCycle();
                const currentIndex = cycle.indexOf(app.vacMode);
                const next = cycle[(currentIndex + 1) % cycle.length];
                app.setVacMode(next);
                refreshVacControls();
            },
        );
        buttonPanel.addControl(vacModeButton);

        // Add the buttonPanel to the userPanel
        this.advancedTexture.addControl(buttonPanel)

        // add some textual instructions at bottom  to use WASD and 
        // mouse to move the camera
        const instructions = new GUI.TextBlock();
        instructions.text = 'WASD and mouse to move camera or HMD';
        instructions.color = 'white';
        instructions.fontSize = '12px';
        instructions.width = '250px';
        instructions.height = '18px';
        instructions.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        instructions.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

        // add a background to the instructions
        const instructionsBackground = new GUI.Rectangle();
        instructionsBackground.background = 'red'; // dark red
        instructionsBackground.alpha = 0.2;
        instructionsBackground.thickness = 2;
        instructionsBackground.width = instructions.width;
        instructionsBackground.height = instructions.height;
        instructionsBackground.top = instructions.top;
        instructionsBackground.left = instructions.left;
        instructionsBackground.paddingLeft = instructions.paddingLeft;
        instructionsBackground.horizontalAlignment = instructions.horizontalAlignment;
        instructionsBackground.verticalAlignment = instructions.verticalAlignment;
        instructionsBackground.cornerRadius = 3;
        this.advancedTexture.addControl(instructionsBackground);
        this.advancedTexture.addControl(instructions);

        // add leftbutton and rightbutton to a panel 20px from the previous buttonPanel
        const envButtonPanel = new GUI.StackPanel();
        envButtonPanel.isVertical = false;
        envButtonPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        envButtonPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        envButtonPanel.width = '100px';
        envButtonPanel.height = '100px';
        envButtonPanel.paddingBottom = '40px';
        this.advancedTexture.addControl(envButtonPanel);

        // create a left and right button to change the loaded environment
        const leftButton = this.createToggleButton('<', '#800080', () => {
            app.loadNextEnvironment(false, scene);
            refreshVacControls();
        });
        const rightButton = this.createToggleButton('>', '#800080', () => {
            app.loadNextEnvironment(true, scene);
            refreshVacControls();
        });
        leftButton.cornerRadius = 10;
        rightButton.cornerRadius = 10;
        leftButton.width = '50px';
        rightButton.width = '50px';
        envButtonPanel.addControl(leftButton);
        envButtonPanel.addControl(rightButton);

        // create a button to toggle whether HMD is controlled by user
        const toggleHMDControlButton = this.createToggleButton('Move HMD', '#008000', () => {
            app.toggleHMDControl();
        });
        buttonPanel.addControl(toggleHMDControlButton);
    }

    /** 
     * Helper UI function to create toggle buttons
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
        button.paddingLeft = '3px'
        button.paddingRight = '3px'
        button.paddingBottom = '20px'

        const textBlock = new GUI.TextBlock();
        textBlock.text = text;
        textBlock.fontSize = '14px';
        button.addControl(textBlock);

        button.onPointerClickObservable.add(onClickHandler);

        return button;
    }

    /**
     * Create a virtual joystick to control the camera.
     * - on moving, the main camera will be translated
     * @returns The virtual joystick.
     */
    createVirtualJoystick() {
        // create a virtual joystick to control the camera
        const joystick = new VirtualJoystick();
        joystick.setJoystickSensibility(0.5);
        joystick.setJoystickColor('red');
        return joystick;
    }

    /**
     * Create a loading indicator with animated spinner.
     */
    private createLoadingIndicator() {
        // Create container for loading UI
        this.loadingContainer = new GUI.Container();
        this.loadingContainer.width = "100%";
        this.loadingContainer.height = "100%";
        this.loadingContainer.isVisible = false; // Hidden by default
        this.advancedTexture.addControl(this.loadingContainer);

        // Semi-transparent background
        const background = new GUI.Rectangle();
        background.width = "100%";
        background.height = "100%";
        background.background = "rgba(0, 0, 0, 0.7)";
        background.thickness = 0;
        this.loadingContainer.addControl(background);

        // Create circular progress spinner
        const spinnerContainer = new GUI.Container();
        spinnerContainer.width = "120px";
        spinnerContainer.height = "120px";
        this.loadingContainer.addControl(spinnerContainer);

        // Outer circle (track)
        const outerCircle = new GUI.Ellipse();
        outerCircle.width = "100px";
        outerCircle.height = "100px";
        outerCircle.color = "rgba(255, 255, 255, 0.3)";
        outerCircle.thickness = 8;
        outerCircle.background = "transparent";
        spinnerContainer.addControl(outerCircle);

        // Inner rotating circle (progress indicator)
        const innerCircle = new GUI.Ellipse();
        innerCircle.width = "100px";
        innerCircle.height = "100px";
        innerCircle.color = "#9b59b6"; // Purple color matching theme
        innerCircle.thickness = 8;
        innerCircle.background = "transparent";
        innerCircle.arc = 0.75; // Show 3/4 of the circle
        spinnerContainer.addControl(innerCircle);

        // Animate the spinner rotation
        let angle = 0;
        const animate = () => {
            if (this.loadingContainer.isVisible) {
                angle += 0.05;
                innerCircle.rotation = angle;
                requestAnimationFrame(animate);
            }
        };

        // Start animation when visible
        this.loadingContainer.onIsVisibleChangedObservable.add((isVisible) => {
            if (isVisible) {
                angle = 0;
                animate();
            }
        });

        // Loading text below spinner
        this.loadingText = new GUI.TextBlock();
        this.loadingText.text = "Loading...";
        this.loadingText.color = "white";
        this.loadingText.fontSize = 24;
        this.loadingText.top = "80px";
        spinnerContainer.addControl(this.loadingText);
    }

    /**
     * Show the loading indicator.
     */
    showLoading(message: string = "Loading...") {
        this.loadingText.text = message;
        this.loadingContainer.isVisible = true;
    }

    /**
     * Hide the loading indicator.
     */
    hideLoading() {
        this.loadingContainer.isVisible = false;
    }

}
