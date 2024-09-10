import * as THREE from "three";
import Stats from "stats.js";
import * as BUI from "@thatopen/ui";
import * as BUIC from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as WEBIFC from 'web-ifc';
import * as OBCF from "@thatopen/components-front";

BUI.Manager.init();
BUIC.Manager.init();

const container = document.getElementById("container");

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);
const world = worlds.create();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBCF.RendererWith2D(components, container);
world.camera = new OBC.OrthoPerspectiveCamera(components);

components.init();
world.scene.setup();

world.camera.controls.setLookAt(5, 2, 5, 0, 0, 0);

container.appendChild(world.renderer.three2D.domElement);



const grids = components.get(OBC.Grids);
grids.create(world);

world.scene.three.background = null;

//loading in a single cube
// const cubeGeometry = new THREE.BoxGeometry(3, 3, 3);
// const cubeMaterial = new THREE.MeshStandardMaterial({ color: "#6528D7" });
// const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
// cube.position.set(0, 1.5, 0);
// world.scene.three.add(cube);
// world.meshes.add(cube);

//loading the model of a classroom
// const fragments = components.get(OBC.FragmentsManager);
// const file = await fetch(
//   "https://thatopen.github.io/engine_components/resources/small.frag",
// );
// const data = await file.arrayBuffer();
// const buffer = new Uint8Array(data);
// const model = fragments.load(buffer);
// world.scene.three.add(model);



//loading a model via fragment manager
const fragments = components.get(OBC.FragmentsManager);
const file = await fetch(
  "https://thatopen.github.io/engine_components/resources/small.frag",
);
const data = await file.arrayBuffer();
const buffer = new Uint8Array(data);
const model = fragments.load(buffer);
world.scene.three.add(model);

const properties = await fetch(
  "https://thatopen.github.io/engine_components/resources/small.json",
);
model.setLocalProperties(await properties.json());
console.log(properties)

const indexer = components.get(OBC.IfcRelationsIndexer);
await indexer.process(model);
const relationsFile = await fetch(
  "https://thatopen.github.io/engine_components/resources/small-relations.json",
);
const relations = indexer.getRelationsMapFromJSON(await relationsFile.text());
indexer.setRelationMap(model, relations);

const hider = components.get(OBC.Hider);

const classifier = components.get(OBC.Classifier);
classifier.byEntity(model);
await classifier.bySpatialStructure(model, {
  isolate: new Set([WEBIFC.IFCBUILDINGSTOREY]),
});

//ifc loader
//const fragments = components.get(OBC.FragmentsManager);
const fragmentIfcLoader = components.get(OBC.IfcLoader);
await fragmentIfcLoader.setup();

const excludedCats = [
  // WEBIFC.IFCTENDONANCHOR,
  // WEBIFC.IFCREINFORCINGBAR,
  // WEBIFC.IFCREINFORCINGELEMENT,
];

for (const cat of excludedCats) {
  fragmentIfcLoader.settings.excludedCategories.add(cat);
}

fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

async function loadIfc() {
  const file = await fetch(
    "https://thatopen.github.io/engine_components/resources/small.ifc",
  );
  const data = await file.arrayBuffer();
  const buffer = new Uint8Array(data);
  const model = await fragmentIfcLoader.load(buffer);
  model.name = "example";
  world.scene.three.add(model);
}

fragments.onFragmentsLoaded.add((model) => {
  console.log(model);
});

function download(file) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function exportFragments() {
  if (!fragments.groups.size) {
    return;
  }
  const group = Array.from(fragments.groups.values())[0];
  const data = fragments.export(group);
  download(new File([new Blob([data])], "small.frag"));

  const properties = group.getLocalProperties();
  if (properties) {
    download(new File([JSON.stringify(properties)], "small.json"));
  }
}

function disposeFragments() {
  fragments.dispose();
}

//getting element property sets
const psets = indexer.getEntityRelations(model, 6518, "IsDefinedBy");
if (psets) {
  for (const expressID of psets) {
    // You can get the pset attributes like this
    const pset = await model.getProperties(expressID);
    console.log(pset);
    // You can get the pset props like this or iterate over pset.HasProperties yourself
    await OBC.IfcPropertiesUtils.getPsetProps(
      model,
      expressID,
      async (propExpressID) => {
        const prop = await model.getProperties(propExpressID);
        console.log(prop);
      },
    );
  }
}

//download a JSON of the indexation so you can reuse it later
const downloadJSON = (json, name) => {
  const file = new File([json], name);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(a.href);
};

const json = indexer.serializeModelRelations(model);
console.log(json);

const allRelationsJSON = indexer.serializeAllRelations();

//loading back in the relations index
// Lets first delete the existing model relations
delete indexer.relationMaps[model.uuid];
const relationsIndexFile = await fetch(
  "https://thatopen.github.io/engine_components/resources/small-relations.json",
);
const relationsIndex = indexer.getRelationsMapFromJSON(
  await relationsIndexFile.text(),
);

indexer.setRelationMap(model, relationsIndex);

const buildingStorey = indexer.getEntityRelations(
  model,
  6518,
  "ContainedInStructure",
);

if (buildingStorey && buildingStorey[0]) {
  const storey = await model.getProperties(buildingStorey[0]);
  console.log(storey);
}

//getting the raycasters
const casters = components.get(OBC.Raycasters); //also used in measurement utils section
casters.get(world);

const clipper = components.get(OBC.Clipper);

clipper.enabled = true;

// //Civil3D navigator
// const navigator = components.get(OBCF.Civil3DNavigator);
// navigator.world = world;
// navigator.draw(model);

// const sphere = new THREE.Sphere(undefined, 20);

// navigator.onHighlight.add(({ point }) => {
//   sphere.center.copy(point);
//   world.camera.controls.fitToSphere(sphere, true);
// });

// //civil plan navigator
// const world2D = document.getElementById("scene-2d");
// const planNavigator = components.get(OBCF.CivilPlanNavigator);
// world2D.components = components;
// planNavigator.world = world2D.world;
// await planNavigator.draw(model);






// //civil cross section navigator
// const world2DRight = document.getElementById("scene-2d-right") ;
// world2DRight.components = components;
// if (!world2DRight.world) {
//   throw new Error("World not found!");
// }

// const crossNavigator = components.get(OBCF.CivilCrossSectionNavigator);
// crossNavigator.world = world2DRight.world;
// crossNavigator.world3D = world;

// //binding the navigators so they all move together
// planNavigator.onMarkerChange.add(({ alignment, percentage, type, curve }) => {
//   navigator3D.setMarker(alignment, percentage, type);
//   if (type === "select") {
//     const mesh = curve.alignment.absolute[curve.index].mesh;
//     const point = alignment.getPointAt(percentage, "absolute");
//     crossNavigator.set(mesh, point);
//   }
// });

// planNavigator.onHighlight.add(({ mesh }) => {
//   navigator3D.highlighter.select(mesh);
//   const index = mesh.curve.index;
//   const curve3d = mesh.curve.alignment.absolute[index];
//   curve3d.mesh.geometry.computeBoundingSphere();
//   const sphere = curve3d.mesh.geometry.boundingSphere;
//   if (sphere) {
//     world.camera.controls.fitToSphere(sphere, true);
//   }
// });

// planNavigator.onMarkerHidden.add(({ type }) => {
//   navigator3D.hideMarker(type);
// });

// //styles for the civil navigator
// const classifierCivil = components.get(OBC.Classifier);
// classifierCivil.byEntity(model);
// const classifications = classifierCivil.list;

// const clipper1 = components.get(OBCF.ClipEdges);
// const styles = clipper1.styles.list;

// for (const category in classifications.entities) {
//   const found = classifierCivil.find({ entities: [category] });

//   const color = new THREE.Color(Math.random(), Math.random(), Math.random());
//   const lineMaterial = new THREE.LineBasicMaterial({ color });
//   clipper1.styles.create(category, new Set(), world2DRight.world, lineMaterial);

//   for (const fragID in found) {
//     const foundFrag = fragments.list.get(fragID);
//     if (!foundFrag) {
//       continue;
//     }
//     styles[category].fragments[fragID] = new Set(found[fragID]);
//     styles[category].meshes.add(foundFrag.mesh);
//   }
// }

// clipper1.update(true);

//loading the bounding box of the model
const fragmentBbox = components.get(OBC.BoundingBoxer);
fragmentBbox.add(model);

const bbox = fragmentBbox.getMesh();
fragmentBbox.reset();


//culling - ie hiding objects that are not visible
const cullers = components.get(OBC.Cullers);
const culler = cullers.create(world);

culler.threshold = 10;

for (const child of model.children) {
  if (child instanceof THREE.InstancedMesh) {
    culler.add(child);
  }
}

culler.needsUpdate = true;

world.camera.controls.addEventListener("sleep", () => {
  culler.needsUpdate = true;
});

//loading in a bunch of the cubes
// const cubes = [];
// const geometry = new THREE.BoxGeometry(2, 2, 2);
// const material = new THREE.MeshLambertMaterial({ color: "#6528D7" });
// function getRandomNumber(limit) {
//   return Math.random() * limit;
// }
// function regenerateCubes() {
//   for (let i = 0; i < 300; i++) {
//     const cube = new THREE.Mesh(geometry, material);
//     cube.position.x = getRandomNumber(20);
//     cube.position.y = getRandomNumber(10);
//     cube.position.z = getRandomNumber(10);
//     cube.updateMatrix();
//     world.scene.three.add(cube);
//     culler.add(cube);
//     cubes.push(cube);
//   }
// }

// regenerateCubes();

culler.needsUpdate = true;
// world.camera.controls.addEventListener("controlend", () => {
//   culler.needsUpdate = true;
// });


container.ondblclick = () => {
  if (clipper.enabled) {
    clipper.create(world);
  }
};

window.onkeydown = (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    if (clipper.enabled) {
      clipper.delete(world);
    }
  }
};

const highlighter = components.get(OBCF.Highlighter);
highlighter.setup({ world });
highlighter.zoomToSelection = true;

//for creatign BIM tiles
const tiler = components.get(OBC.IfcGeometryTiler);

const wasm = {
  path: "https://unpkg.com/web-ifc@0.0.57/",
  absolute: true,
};

tiler.settings.wasm = wasm;
tiler.settings.minGeometrySize = 20;
tiler.settings.minAssetsSize = 1000;

//bim Tiles - JSON
/**
 * @typedef {Object} GeometriesStreaming
 * @property {Object[]} assets
 * @property {number} assets.id
 * @property {Object[]} assets.geometries
 * @property {number[]} assets.geometries.color
 * @property {number} assets.geometries.geometryID
 * @property {number[]} assets.geometries.transformation
 * @property {Object.<number, Object>} geometries
 * @property {Object.<number, number>} geometries.boundingBox
 * @property {boolean} geometries.hasHoles
 * @property {string} geometries.geometryFile
 * @property {string} globalDataFileId
 */

/**
 * Example usage of GeometriesStreaming
 * @type {GeometriesStreaming}
 */
const exampleGeometriesStreaming = {
  assets: [
    {
      id: 1,
      geometries: [
        {
          color: [255, 0, 0],
          geometryID: 101,
          transformation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
      ],
    },
  ],
  geometries: {
    101: {
      boundingBox: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
      hasHoles: false,
      geometryFile: "url-to-geometry-file-in-your-backend",
    },
  },
  globalDataFileId: "url-to-fragments-group-file-in-your-backend",
};

let files = [];
let geometriesData = {};
let geometryFilesCount = 1;

tiler.onGeometryStreamed.add((geometry) => {
  const { buffer, data } = geometry;
  const bufferFileName = `small.ifc-processed-geometries-${geometryFilesCount}`;
  for (const expressID in data) {
    const value = data[expressID];
    value.geometryFile = bufferFileName;
    geometriesData[expressID] = value;
  }
  files.push({ name: bufferFileName, bits: [buffer] });
  geometryFilesCount++;
});

let assetsData = [];

tiler.onAssetStreamed.add((assets) => {
  assetsData = [...assetsData, ...assets];
});

tiler.onIfcLoaded.add((groupBuffer) => {
  files.push({
    name: "small.ifc-processed-global",
    bits: [groupBuffer],
  });
});

function downloadFile(name, ...bits) {
  const file = new File(bits, name);
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(file);
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadFilesSequentially(fileList) {
  for (const { name, bits } of fileList) {
    downloadFile(name, ...bits);
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
}

tiler.onProgress.add((progress) => {
  if (progress !== 1) return;
  setTimeout(async () => {
    const processedData = {
      geometries: geometriesData,
      assets: assetsData,
      globalDataFileId: "small.ifc-processed-global",
    };
    files.push({
      name: "small.ifc-processed.json",
      bits: [JSON.stringify(processedData)],
    });
    await downloadFilesSequentially(files);
    assetsData = [];
    geometriesData = {};
    files = [];
    geometryFilesCount = 1;
  });
});

async function processFile() {
  const fetchedIfc = await fetch(
    "https://thatopen.github.io/engine_components/resources/small.ifc",
  );
  const ifcBuffer = await fetchedIfc.arrayBuffer();
  // We will need this information later to also convert the properties
  const ifcArrayBuffer = new Uint8Array(ifcBuffer);
  // This triggers the conversion, so the listeners start to be called
  await tiler.streamFromBuffer(ifcArrayBuffer);
}

//measurement utils - showing the edges of a face
const edges = new THREE.EdgesGeometry();
const material = new THREE.LineBasicMaterial({
  color: 0xff0000,
  depthTest: false,
});
const line = new THREE.LineSegments(edges, material);
world.scene.three.add(line);

const measurements = components.get(OBC.MeasurementUtils);
//const casters = components.get(OBC.Raycasters); this is decalred earlier
const caster = casters.get(world);

if (world.renderer) {
  const canvas = world.renderer.three.domElement;
  canvas.addEventListener("pointermove", () => {
    const result = caster.castRay([model]);

    if (!result) return;
    if (!(result.object instanceof THREE.Mesh)) return;
    if (result.faceIndex === undefined) return;

    const face = measurements.getFace(
      result.object,
      result.faceIndex,
      result.instanceId,
    );

    if (face) {
      const points = [];
      for (const edge of face.edges) {
        points.push(...edge.points);
      }
      edges.setFromPoints(points);
    }
  });
}

//Measurement - length
const cubeGeometry1 = new THREE.BoxGeometry(3, 3, 3);
const cubeMaterial1 = new THREE.MeshStandardMaterial({ color: "#6528D7" });
const cube1 = new THREE.Mesh(cubeGeometry1, cubeMaterial1);
cube1.position.set(0, 1.5, 0);
world.scene.three.add(cube1);
world.meshes.add(cube1);

const dimensions = components.get(OBCF.LengthMeasurement);
dimensions.world = world;
dimensions.enabled = true;
dimensions.snapDistance = 1;

//container.ondblclick = () => dimensions.create();

window.onkeydown = (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    dimensions.delete();
  }
};

//for filtering the model
const spatialStructures = {};
const structureNames = Object.keys(classifier.list.spatialStructures);
for (const name of structureNames) {
  spatialStructures[name] = true;
}

const classes= {};
const classNames = Object.keys(classifier.list.entities);
for (const name of classNames) {
  classes[name] = true;
}

//2d markers in the model view
const marker = components.get(OBCF.Marker);

marker.threshold = 1;

for (let i = 0; i < 20; i++) {
  const x = Math.random() * 5;
  const y = Math.random() * 5;
  const z = Math.random() * 5;
  marker.create(world, "🚀", new THREE.Vector3(x, y, z));
}


//statistics for performance
const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());





const panel = BUI.Component.create(() => {
  return BUI.html`

        <bim-panel label="ColBIM" class="options-menu">
      <bim-panel-section collapsed label="Commands">
        <bim-label>Double click: Create clipping plane</bim-label>
        <bim-label>Delete key: Delete clipping plane</bim-label>
      </bim-panel-section>
      <bim-panel-section collapsed label="Clipping">
        <bim-checkbox label="Clipper enabled" checked 
          @change="${({ target }) => {
            clipper.enabled = target.value;
          }}">
        </bim-checkbox>
        <bim-checkbox label="Clipper visible" checked 
          @change="${({ target }) => {
            clipper.visible = target.value;
          }}">
        </bim-checkbox>
        <bim-color-input 
          label="Planes Color" color="#202932" 
          @input="${({ target }) => {
            clipper.material.color.set(target.color);
          }}">
        </bim-color-input>
        <bim-number-input 
          slider step="0.01" label="Planes opacity" value="0.2" min="0.1" max="1"
          @change="${({ target }) => {
            clipper.material.opacity = target.value;
          }}">
        </bim-number-input>
        <bim-number-input 
          slider step="0.1" label="Planes size" value="5" min="2" max="10"
          @change="${({ target }) => {
            clipper.size = target.value;
          }}">
        </bim-number-input>
        <bim-button 
          label="Delete all" 
          @click="${() => {
            clipper.deleteAll();
          }}">  
        </bim-button>        
        <bim-button 
          label="Rotate cube" 
          @click="${() => {
            cube.rotation.x = 2 * Math.PI * Math.random();
            cube.rotation.y = 2 * Math.PI * Math.random();
            cube.rotation.z = 2 * Math.PI * Math.random();
          }}">  
        </bim-button>
      </bim-panel-section>
        <bim-button 
          label="Fit BIM model" 
          @click="${() => {
            world.camera.controls.fitToSphere(bbox, true);
          }}">  
        </bim-button>
      
        
              <bim-panel-section collapsed label="Filtering">

      <bim-panel-section collapsed label="Floors" name="Floors"">
      </bim-panel-section>
      
      <bim-panel-section collapsed label="Categories" name="Categories"">
      </bim-panel-section>
      </bim-panel-section>
      <bim-button label="Load IFC"
          @click="${() => {
            processFile();
          }}">
        </bim-button>
        <bim-panel-section collapsed label="IFC Loader">
        <bim-panel-section style="padding-top: 12px;">
      
          <bim-button label="Load IFC"
            @click="${() => {
              loadIfc();
            }}">
          </bim-button>  
              
          <bim-button label="Export fragments"
            @click="${() => {
              exportFragments();
            }}">
          </bim-button>  
              
          <bim-button label="Dispose fragments"
            @click="${() => {
              disposeFragments();
            }}">
          </bim-button>
        
      </bim-panel-section>
      </bim-panel-section>

      <bim-panel-section collapsed label="IFC Relations Indexer">
      <bim-panel-section style="padding-top: 10px;">
      
        <bim-button 
          label="Download relations" 
          @click="${async () => {
            downloadJSON(allRelationsJSON, "relations-index-all.json");
          }}">  
        </bim-button>        

      </bim-panel-section>

      <bim-panel-section collapsed label="Controls">
          <bim-label>Create dimension: Double click</bim-label>  
          <bim-label>Delete dimension: Delete</bim-label>  
      </bim-panel-section>
      </bim-panel-section>
      
      <bim-panel-section collapsed label="Length Measurement">
        <bim-checkbox checked label="Dimensions enabled" 
          @change="${({ target }) => {
            dimensions.enabled = target.value;
          }}">  
        </bim-checkbox>       
        <bim-checkbox checked label="Dimensions visible" 
          @change="${({ target }) => {
            dimensions.visible = target.value;
          }}">  
        </bim-checkbox>  
        
        <bim-color-input 
          label="Dimensions Color" color="#202932" 
          @input="${({ target }) => {
            dimensions.color.set(target.color);
          }}">
        </bim-color-input>
        
        <bim-button label="Delete all"
          @click="${() => {
            dimensions.deleteAll();
          }}">
        </bim-button>

      </bim-panel-section>
</bim-panel>
     
    

    
  `;
});





document.body.append(panel);


const floorSection = panel.querySelector(
  "bim-panel-section[name='Floors']",
) ;

const categorySection = panel.querySelector(
  "bim-panel-section[name='Categories']",
) ;

for (const name in spatialStructures) {
  const panel = BUI.Component.create(() => {
    return BUI.html`
      <bim-checkbox checked label="${name}"
        @change="${({ target }) => {
          const found = classifier.list.spatialStructures[name];
          if (found && found.id !== null) {
            for (const [_id, model] of fragments.groups) {
              const foundIDs = indexer.getEntityChildren(model, found.id);
              const fragMap = model.getFragmentMap(foundIDs);
              hider.set(target.value, fragMap);
            }
          }
        }}">
      </bim-checkbox>
    `;
  });
  floorSection.append(panel);
}

for (const name in classes) {
  const checkbox = BUI.Component.create(() => {
    return BUI.html`
      <bim-checkbox checked label="${name}"
        @change="${({ target }) => {
          const found = classifier.find({ entities: [name] });
          hider.set(target.value, found);
        }}">
      </bim-checkbox>
    `;
  });
  categorySection.append(checkbox);
}

const button = BUI.Component.create(() => {
  return BUI.html`
    <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
      @click="${() => {
        if (panel.classList.contains("options-menu-visible")) {
          panel.classList.remove("options-menu-visible");
        } else {
          panel.classList.add("options-menu-visible");
        }
      }}">
    </bim-button>
  `;
});

document.body.append(button);

//ui
{/*  */}