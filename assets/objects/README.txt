DROP-IN OBJECT ART
==================

Put transparent PNG sprites here, one per object, and the game will use them
automatically instead of its built-in drawings. Anything without a sprite keeps
its current code drawing, so you can add art a few objects at a time.

HOW IT WORKS
------------
1. Drop a transparent .png in this folder.
2. Add ONE line to the manifest in:
       src/game/ObjectSpriteRegistry.ts   ->  OBJECT_SPRITE_MANIFEST
   (or just tell Claude the file name + which object and it will add it.)
3. Done — that object now shows your picture.

FILE NAMING (the texture key matches the file name)
---------------------------------------------------
   crop:     crop-<cropKey>-<stage>.png      stage = sprout | growing | ready
   tree:     tree-<treeKey>-<stage>.png      stage = sapling | grown | ready | dead
   animal:   animal-<animalKey>-<state>.png  state = idle | hungry | ready
   building: building-<buildingKey>.png      (also decorations & dogs)
   fish:     fish-<fishKey>.png

A stage/state is optional. If you only have one picture for an object, name it
without the suffix (e.g. animal-karve.png) and it's used for every state.

Example manifest lines:
   { key: objectTextureKey("animal", "karve"), file: "animal-karve.png" },
   { key: objectTextureKey("crop", "salotos", "ready"), file: "crop-salotos-ready.png" },

ANCHORING & SIZE
----------------
- Draw the object's BASE at the BOTTOM-CENTRE of the image (it gets anchored to
  the front-centre of its tile). Leave the object standing on the bottom edge.
- Tiles are 72 x 36 px. Good starting sizes (at 1x): crops ~72x96, trees
  ~110x150, animals ~80x80, buildings ~150x170. Bigger is fine — keep it
  proportional and it'll sit correctly.

ANIMATION (optional)
--------------------
Make a horizontal strip of equal frames (e.g. 4 frames of 80x80 side by side =
320x80) and give its manifest line a frame size:
   { key: objectTextureKey("animal", "vista"), file: "animal-vista.png",
     frame: { width: 80, height: 80 } },
The frames then play on a loop.

KEY NAMES
---------
The <cropKey>/<treeKey>/<animalKey>/<buildingKey>/<fishKey> values are the
internal ids in src/game/definitions.ts (e.g. salotos, obelis, karve, tvartas,
karosas). Ask Claude for the full list if you need it.
