# Playground to contain sample apps

# Naming Conventions

Files are named using camelCase. For example, `myModule.ts`, to follow Babylon.js naming conventions.

# How to run

Just go to the live page built from the latest version that is served via GitHub pages: https://sit-dia.github.io/dia-playground/ 

## Some interesting things to try

Increase the distLens2Display until it is greater than the focal length, f, of the lens. Something will flip...

Increase the IPD until the frustum do not overlap anymore.

Reduce the eyeRelief to see how the frustum changes.

## Architecture

The application simply uses a 2-layer architecture: App and UI.

Draw UML disgram here:
```
 +-----------------+         +-----------------+
 |       App       | ---o)---|        UI       |
 +-----------------+         +-----------------+
   o
   |
   |
   |    +-----------------+
   -----|       HMD       |
   |    +-----------------+
   |
   ,
   -----| FrustumVisualizer|
        +------------------+
```

The HMD class represents a VR headset's parameters and functionalities, including setup for simulated eye cameras and their projections.

The FrustumVisualizer class is used to visualize the frustum of a camera in the scene.

The App class is responsible for creating the scene and updating the scene based on the HMD.
- App owns the HMD and the FrustumVisualizer.
- App provides APIs for the UI to interact with the scene.

The UI class is responsible for handling user interactions and use the App to update the scene.
- UI knows about the App but App does not know about the UI.
