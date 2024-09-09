import * as THREE from "three";
import Stats from "stats.js";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as WEBIFC from 'web-ifc';

const container = document.getElementById("container");

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);
const world = worlds.create(
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBC.SimpleRenderer
);

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();

world.camera.controls.setLookAt(10, 10, 10, 0, 0, 0);

world.scene.setup();

const grids = components.get(OBC.Grids);
grids.create(world);

world.scene.three.background = null;

//loading in a single cube
const cubeGeometry = new THREE.BoxGeometry(3, 3, 3);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: "#6528D7" });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(0, 1.5, 0);
world.scene.three.add(cube);
world.meshes.add(cube);

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


//getting the raycasters
const casters = components.get(OBC.Raycasters);
casters.get(world);

const clipper = components.get(OBC.Clipper);

clipper.enabled = true;

//loading the bounding box of the model
const fragmentBbox = components.get(OBC.BoundingBoxer);
fragmentBbox.add(model);

const bbox = fragmentBbox.getMesh();
fragmentBbox.reset();


//culling - ie hiding objects that are not visible
const cullers = components.get(OBC.Cullers);
const culler = cullers.create(world);

culler.threshold = 200;

culler.renderDebugFrame = true;
const debugFrame = culler.renderer.domElement;
document.body.appendChild(debugFrame);
debugFrame.style.position = "fixed";
debugFrame.style.left = "0";
debugFrame.style.bottom = "0";
debugFrame.style.visibility = "collapse";

const cubes = [];
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshLambertMaterial({ color: "#6528D7" });
function getRandomNumber(limit) {
  return Math.random() * limit;
}
function regenerateCubes() {
  for (let i = 0; i < 300; i++) {
    const cube = new THREE.Mesh(geometry, material);
    cube.position.x = getRandomNumber(20);
    cube.position.y = getRandomNumber(10);
    cube.position.z = getRandomNumber(10);
    cube.updateMatrix();
    world.scene.three.add(cube);
    culler.add(cube);
    cubes.push(cube);
  }
}

regenerateCubes();

culler.needsUpdate = true;
world.camera.controls.addEventListener("controlend", () => {
  culler.needsUpdate = true;
});


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

const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

BUI.Manager.init();

const panel = BUI.Component.create(() => {
  return BUI.html`

        <bim-panel label="Clipper Tutorial" class="options-menu">
      <bim-panel-section collapsed label="Commands">
        <bim-label>Double click: Create clipping plane</bim-label>
        <bim-label>Delete key: Delete clipping plane</bim-label>
      </bim-panel-section>
      <bim-panel-section collapsed label="Others">
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
      
        
      
      <bim-panel-section collapsed label="Floors" name="Floors"">
      </bim-panel-section>
      
      <bim-panel-section collapsed label="Categories" name="Categories"">
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