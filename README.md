# DIAversity

The code uni**versity** for **D**eveloping **I**mmersive **A**pplications (**DIA**).

This project is currently ambitious in name only :) but we hope for it to grow into a collection of learning resources for developing immersive applications.

Currently, it only contains a VR head-mounted display (HMD) simulator that helps to interactively understand the optical and graphical concepts behind VR HMDs.

One of the current motivations is to support the YouTube DIA series: https://youtube.com/playlist?list=PLMKD6gDV_13-jVPNyDLUd4y6gSw0lMM-h&si=CZzlTOKfM5KPz5Ee

# How to run

Just go to the live page built from the latest version that is served via GitHub pages: https://sit-dia.github.io/dia-playground/ 

## Some interesting things to try

Increase the distLens2Display until it is greater than the focal length, f, of the lens. Something will flip...

Increase the IPD until the frustum do not overlap anymore.

Reduce the eyeRelief to see how the frustum changes.

# How to build and run locally

## Prerequisites

This is a TypeScript project that uses npm for package management. You need to have Node.js installed to run npm. You can install Node.js from https://nodejs.org/en/download/

## Steps

1. Clone the repository
2. Run `npm i` to install the dependencies as specified in `package.json`
3. Run `npm run dev` to start the development server

You can check out the `package.json` file to see other available scripts.

# Architecture

The application simply uses a 2-layer architecture: App and UI.

Draw UML diagram here:
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
   |    +------------------+
   -----| FrustumVisualizer|
        +------------------+
```

The HMD class represents a VR headset's parameters and functionalities, including setup for simulated eye cameras and their projections.

The FrustumVisualizer class is used to visualize the frustum of a camera in the scene.

The App class is responsible for creating the scene and updatig the scene based on the HMD.
- App owns the HMD and the FrustumVisualizer.
- App provides APIs for the UI to interact with the scene.

The UI class is responsible for handling user interactions and use the App to update the scene.
- UI knows about the App but App does not know about the UI.

# References

The rendering framework is primarily based on Babylon.js:
https://doc.babylonjs.com/

The math and implementation were studied from the following sources:
- HMD concepts: https://youtu.be/OKD4jrnn4WE
- lens optics math: http://hyperphysics.phy-astr.gsu.edu/hbase/geoopt/lenseq.html
- image formation math: https://stanford.edu/class/ee267/lectures/lecture7.pdf
- perspective projection math: https://www.scratchapixel.com/lessons/3d-basic-rendering/perspective-and-orthographic-projection-matrix/opengl-perspective-projection-matrix.html
- perspective projection implementation: https://www.songho.ca/opengl/gl_transform.html
- perspective projection code: https://threejs.org/docs/#api/en/math/Matrix4.makePerspective

Gaussian splats were kindly provided at 
- https://github.com/BabylonJS/Assets/tree/master/splats

# Naming Conventions

Files are named using camelCase. For example, `myModule.ts`, to follow Babylon.js naming conventions.
