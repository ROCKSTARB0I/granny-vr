// furnish.js -- what is in each room.
//
// Granny's house is sparse: two or three pieces per room, all flush against a
// wall, with clear floor in the middle. Nothing here is positioned by hand --
// each piece names a wall and a position along it, and props.js slides it clear
// of doorways, windows, stairs and anything already placed.
//
// Container slot names match the wiki's Item Locations table ("kitchen:cupboard2",
// "jail:ventilator", "car:trunk") so the five spawn presets transcribe directly.
import { Props } from './props.js?v=9';

export function furnish(world) {
  const p = new Props(world);

  /* ------------------------------------------------------------ upper floor */
  p.in('startingBedroom', (q) => {
    q.bed({ side: 'S', t: 0.28 });
    q.dresser({ side: 'N', t: 0.72, slot: 'startingBedroom:chest', drawers: 3,
                topSlot: 'startingBedroom:chestTop' });
    q.roundTable({ side: 'E', t: 0.7, slot: 'startingBedroom:table' });
  });

  p.in('bedroom1', (q) => {
    q.bed({ side: 'W', t: 0.5 });
    q.dresser({ side: 'N', t: 0.7, slot: 'bedroom1:chest', drawers: 3,
                topSlot: 'bedroom1:chestTop' });
    q.shelf({ side: 'E', t: 0.5, slot: 'bedroom1:shelf', levels: 2, w: 0.9 });
  });

  p.in('bedroom2', (q) => {
    q.bed({ side: 'S', t: 0.3 });
    q.dresser({ side: 'W', t: 0.35, slot: 'bedroom2', drawers: 2,
                topSlot: 'bedroom2:chestTop' });
    // The orange painting hides the Bookshelf Room switch.
    q.box(2.6, 1.35, 0.05, 0.66, 0.46, 0.04, 'wallpaperOchre', { tint: 0xa8642a, solid: false });
    q.fixtures.push({ id: 'paintingSwitch', kind: 'switch', ...q._pt(2.93, 1.58, 0.2),
      label: 'Push the painting' });
  });

  p.in('walkInCloset', (q) => {
    q.shelf({ side: 'N', t: 0.75, slot: 'walkInCloset:shelf', levels: 3, w: 0.9 });
  });

  p.in('bookshelfRoom', (q) => {
    q.shelf({ side: 'N', t: 0.3, levels: 4, w: 1.4 });
    q.shelf({ side: 'S', t: 0.35, slot: 'bookshelfRoom:shelf', levels: 4, w: 1.4 });
    // Lectern: place the Book here to start the freeing ritual.
    const t = q.table({ centre: true, w: 0.55, d: 0.45, h: 1.0 });
    q.fixtures.push({ id: 'lectern', kind: 'lectern',
      ...q._pt(t.lx + 0.27, 1.05, t.lz + 0.22), label: 'Lectern' });
    q._container('bookshelfRoom:corner', null, 3.6, 0.15, 1.9, 'shelf').label = 'Corner';
  });

  p.in('bathroom', (q) => {
    q.bathtub({ side: 'S', t: 0.5 });
    q.toilet({ side: 'E', t: 0.28, slot: 'bathroom:toilet' });
    q.sink({ side: 'E', t: 0.68 });
    q._container('bathroom:tub', null, 1.0, 0.3, 3.2, 'tub').label = 'Bathtub';
  });

  p.in('nursery', (q) => {
    q.crib({ side: 'S', t: 0.35 });
    q.dresser({ side: 'E', t: 0.4, slot: 'nursery', drawers: 2, topSlot: 'nursery:chestTop' });
  });

  p.in('mannequinRoom', (q) => {
    q.mannequin(2.7, 1.5); q.mannequin(4.9, 1.3, -0.6);
    q.mannequin(2.9, 5.4, 2.2); q.mannequin(4.8, 5.8, 1.1);
  });

  p.in('hallwayW', (q) => { q.wardrobe({ side: 'S', t: 0.25, slot: 'hallwayW:cabinet' }); });

  p.in('secretEntrance', (q) => {
    q.shelf({ side: 'N', t: 0.35, slot: 'secretEntrance:shelf', levels: 3, w: 1.3 });
  });

  p.in('hiddenCloset', (q) => {
    q.shelf({ side: 'W', t: 0.5, slot: 'hiddenCloset:topLeft',
              slot2: 'hiddenCloset:bottomLeft', levels: 3, w: 1.6 });
    q._container('hiddenCloset:underShelves', null, 0.4, 0.12, 1.0, 'shelf').label = 'Under the shelves';
    q._container('hiddenCloset:hiddenShelf', null, 1.6, 1.4, 0.3, 'shelf').label = 'Hidden shelf';
    q.fixtures.push({ id: 'fakeWall', kind: 'fakeWall', ...q._pt(1.0, 1.0, 1.9), label: 'Loose panel' });
    q._container('hiddenCloset:fakeWall', null, 1.0, 0.55, 1.82, 'shelf').label = 'Behind the wall';
  });

  /* -------------------------------------------------------------- ground */
  p.in('foyer', (q) => {
    q.highShelf({ side: 'N', t: 0.72, slot: 'foyer:highShelf', dy: 2.3 });
    q.wardrobe({ side: 'W', t: 0.82, slot: 'foyer:cabinet' });
    // The Main Door, on the south wall.
    q.fixtures.push({ id: 'mainDoor', kind: 'mainDoor', ...q._pt(3.0, 1.1, 6.84), label: 'Main Door' });
    q.box(2.0, 0, 6.84, 2.0, 2.3, 0.14, 'woodDoor', { tag: 'mainDoor' });
  });

  p.in('livingRoom', (q) => {
    q.sofa({ side: 'S', t: 0.35 });
    q.tv({ side: 'N', t: 0.65, slot: 'livingRoom:tvTable' });
    q.wardrobe({ side: 'W', t: 0.7, slot: 'livingRoom:wardrobe' });
  });

  p.in('diningRoom', (q) => {
    const t = q.table({ centre: true, w: 2.0, d: 1.0 });
    q.chairsAround(t, 4);
    q._container('diningRoom:table', null, t.lx + 1.0, 0.85, t.lz + 0.5, 'shelf').label = 'Dining table';
    q.showcase({ side: 'N', t: 0.75, slot: 'diningRoom:showcase' });
    q.shelf({ side: 'S', t: 0.25, slot: 'diningRoom:shelf', levels: 3, w: 1.1 });
  });

  p.in('kitchen', (q) => {
    q.counter({ side: 'N', t: 0.3, w: 2.2, slot: 'kitchen:countertop' });
    q.stove({ side: 'N', t: 0.75 });
    q.fridge({ side: 'E', t: 0.18 });
    q.microwave({ side: 'S', t: 0.2, slot: 'kitchen:microwave', dy: 0.9 });
    // Six cupboards: three low along the south wall, three high on the north.
    for (let i = 0; i < 3; i++) {
      q.cupboard({ side: 'S', t: 0.42 + i * 0.19, slot: `kitchen:cupboard${i + 1}` });
    }
    for (let i = 0; i < 3; i++) {
      q.cupboard({ side: 'N', t: 0.16 + i * 0.19, slot: `kitchen:cupboard${i + 4}`, dy: 1.5, h: 0.7 });
    }
    // The "locker" -- a tall pantry with three shelves.
    q.wardrobe({ side: 'W', t: 0.62, slot: 'kitchen:locker' });
    q._container('kitchen:lockerTop', null, 0.5, 1.6, 3.4, 'shelf').label = "Locker's top shelf";
    q._container('kitchen:lockerMiddle', null, 0.5, 1.0, 3.4, 'shelf').label = "Locker's middle shelf";
  });

  p.in('study', (q) => {
    q.table({ side: 'N', t: 0.3, w: 1.5, d: 0.75 });
    q.dresser({ side: 'W', t: 0.7, slot: 'study', drawers: 2 });
    q.showcase({ side: 'S', t: 0.3, slot: 'study:showcase' });
    // Both cogwheels go into this safe.
    q.safe({ side: 'E', t: 0.65, slot: 'study:cogwheelSafe', label: 'Cogwheel safe',
             needs: ['redCogwheel', 'orangeCogwheel'] });
  });

  p.in('stairCloset', (q) => {
    q.shelf({ side: 'E', t: 0.5, slot: 'stairCloset:shelf', levels: 3, w: 1.4 });
    q._container('stairCloset:wall', null, 1.1, 1.5, 0.14, 'shelf').label = 'Wall';
    q._container('stairCloset:corner', null, 0.35, 0.12, 2.3, 'shelf').label = 'Back right corner';
  });

  /* ------------------------------------------------------------- outdoors */
  p.in('backyard', (q) => {
    q.well(7.0, 4.6);
    q.crowCage(13.5, 2.4, 'backyard:crowCage');
    q.barrel({ side: 'N', t: 0.86 });
    q.fixtures.push({ id: 'powerBox', kind: 'powerBox', ...q._pt(10.6, 1.3, 7.9), label: 'Power box' });
    q.box(10.4, 1.0, 8.0, 0.46, 0.56, 0.2, 'metalDark');
  });

  p.in('shed', (q) => {
    q.workbench({ side: 'N', t: 0.5, w: 2.2, slot: 'shed:workbench' });
    q.shelf({ side: 'S', t: 0.5, slot: 'shed:bottomShelf', levels: 2, w: 2.2 });
  });

  p.in('playhouse', (q) => {
    q._container('playhouse:floor', null, 1.5, 0.15, 2.0, 'shelf').label = 'Floor';
  });

  /* -------------------------------------------------------------- basement */
  p.in('basement', (q) => {
    q.workbench({ side: 'N', t: 0.3, w: 2.4, slot: 'basement:workbench' });
    q.safe({ side: 'E', t: 0.25, slot: 'basement:safe', key: 'safeKey', label: 'Basement safe' });
    q.shelf({ side: 'S', t: 0.3, levels: 3, w: 1.8 });
    // Circuit breaker -- the second cut for the Main Door's Wire Lock.
    q.box(7.7, 1.15, 5.4, 0.14, 0.55, 0.46, 'metalDark');
    q.fixtures.push({ id: 'circuitBreaker', kind: 'circuitBreaker', ...q._pt(7.6, 1.42, 5.63),
      label: 'Circuit breaker' });
  });

  p.in('dirtRoom', (q) => { q.table({ side: 'N', t: 0.5, w: 1.1, d: 0.7, slot: 'dirtRoom:table' }); });

  /* ---------------------------------------------------------------- garage */
  p.in('garage', (q) => {
    q.car(0.5, 2.7);
    q.workbench({ side: 'N', t: 0.25, w: 2.2, slot: 'garage:table' });
    q.shelf({ side: 'W', t: 0.72, slot: 'garage:leftRack', levels: 3, w: 2.2 });
    // Clear of the Sauna doorway, which shares this wall.
    q.fixtures.push({ id: 'garageDoor', kind: 'garageDoor', ...q._pt(8.6, 1.4, 5.9), label: 'Garage door' });
    q.box(8.72, 0, 4.9, 0.14, 2.6, 2.0, 'metalDark', { tag: 'garageDoor' });
  });

  p.in('sauna', (q) => {
    // Benches along the far wall -- the doorway is on the west side.
    q.box(2.15, 0.34, 0.2, 0.7, 0.12, 2.6, 'woodRaw');
    q.box(2.15, 0.82, 0.2, 0.7, 0.12, 2.6, 'woodRaw');
    q._container('sauna:lowerBench', null, 2.5, 0.48, 1.5, 'shelf').label = 'Lower bench';
    q.fixtures.push({ id: 'saunaBar', kind: 'saunaBar', ...q._pt(0.35, 1.0, 0.5),
      label: 'Barricade the door' });
  });

  /* ------------------------------------------------------- attic / secret */
  p.in('jail', (q) => {
    q.shelf({ side: 'N', t: 0.25, slot: 'jail:shelf', levels: 2, w: 1.2 });
    // Wheelchair.
    q.box(4.5, 0, 3.3, 0.55, 0.46, 0.55, 'metalDark');
    q.box(4.5, 0.46, 3.78, 0.55, 0.55, 0.09, 'metalDark', { solid: false });
    q._container('jail:wheelchair', null, 4.78, 0.25, 3.1, 'shelf').label = 'Behind the wheelchair';
    // The ventilator: cut its wire with the pliers to reach what is inside.
    q.box(5.2, 1.5, 0.1, 0.5, 0.5, 0.14, 'metalDark');
    const v = q._container('jail:ventilator', null, 5.45, 1.75, 0.35, 'shelf');
    v.label = 'Jail ventilator'; v.locked = true; v.needs = 'cut';
    q._container('jail:floor', null, 2.6, 0.12, 2.4, 'shelf').label = 'Floor';
  });

  p.in('saTopFloor', (q) => {
    q.dresser({ side: 'N', t: 0.3, slot: 'saTopFloor', drawers: 2 });
    q._container('saTopFloor:chestMiddle', null, 1.0, 0.6, 0.4, 'shelf').label = 'Middle shelf';
  });

  p.in('saMiddleFloor', (q) => {
    q.shelf({ side: 'W', t: 0.3, slot: 'saMiddleFloor:shelf', levels: 3, w: 1.3 });
    q.safe({ side: 'E', t: 0.3, slot: 'saMiddleFloor:screwdriverSafe',
             label: 'Screwdriver safe', needs: 'screwdriver' });
  });

  p.in('saBottomFloor', (q) => {
    q.safe({ side: 'W', t: 0.2, slot: 'saBottomFloor:screwdriverSafe',
             label: 'Screwdriver safe', needs: 'screwdriver' });
    q.shelf({ side: 'E', t: 0.8, levels: 2, w: 1.4 });
  });

  p.in('oldHouseKitchen', (q) => {
    q.counter({ side: 'N', t: 0.3, w: 2.0 });
    q.cupboard({ side: 'N', t: 0.8, slot: 'oldHouseKitchen:rightCupboard', w: 0.85, h: 0.8, dy: 1.35 });
    q.box(0.25, 0, 3.4, 1.3, 1.3, 0.55, 'brick');       // fireplace
    q._container('oldHouseKitchen:fireplace', null, 0.9, 0.35, 3.5, 'shelf').label = 'Fireplace';
    q.table({ side: 'S', t: 0.6, w: 1.1, d: 0.8, slot: 'oldHouseKitchen:table' });
  });

  p.in('oldHouseDining', (q) => {
    const t = q.table({ centre: true, w: 1.7, d: 0.95 });
    q.chairsAround(t, 2);
    q.shelf({ side: 'S', t: 0.3, levels: 3, w: 1.4 });
  });

  p.in('oldHouseCloset', (q) => { q.barrel({ side: 'N', t: 0.5, slot: 'oldHouseCloset:barrel' }); });

  p.in('meatRoom', (q) => {
    q.table({ side: 'N', t: 0.3, w: 1.4, d: 0.85, slot: 'meatRoom:table' });
    q._container('meatRoom:wall', null, 3.5, 1.5, 0.18, 'shelf').label = 'Wall';
    for (let i = 0; i < 4; i++) {
      q.box(0.7 + i * 0.75, 1.35, 3.3, 0.24, 0.85, 0.24, 'fabricRed', { solid: false, tint: 0x6a2a26 });
    }
  });

  p.in('specialRoom', (q) => {
    q.wardrobe({ side: 'N', t: 0.25, slot: 'specialRoom:locker' });
    q._container('specialRoom:lockerTop', null, 1.0, 1.6, 0.4, 'shelf').label = "Locker's top shelf";
    q.table({ side: 'S', t: 0.6, w: 1.3, d: 0.85, slot: 'specialRoom:table' });
    q.shelf({ side: 'E', t: 0.5, levels: 3, w: 1.8 });
  });

  /* -------------------------------------------------- spider cellar / sewer */
  p.in('cellarHall', (q) => {
    q.shelf({ side: 'N', t: 0.14, slot: 'cellar:shelf', levels: 3, w: 1.4 });
    q._container('cellar:floor', null, 6.0, 0.12, 1.1, 'shelf').label = 'Floor';
    q.pipes(1.0, 2.05, 10);
  });

  p.in('cupboardRow', (q) => {
    for (let i = 0; i < 4; i++) {
      q.cupboard({ side: 'N', t: 0.13 + i * 0.24, slot: `cellar:cupboard${i + 1}`, w: 0.95, h: 1.05 });
    }
    q.safe({ side: 'W', t: 0.75, slot: 'cellar:screwdriverSafe',
             label: 'Screwdriver safe', needs: 'screwdriver' });
    q._container('cellar:hallway', null, 3.0, 0.12, 3.4, 'shelf').label = 'Hallway floor';
    q._container('cellar:drain', null, 4.4, 0.35, 4.7, 'shelf').label = 'Behind the drain bars';
  });

  p.in('pipeRoom', (q) => {
    q.pipes(0.55, 0.6, 6, true);
    q.pipes(4.7, 1.2, 6);
    q.safe({ side: 'S', t: 0.7, slot: 'pipeRoom:screwdriverSafe',
             label: 'Screwdriver safe', needs: 'screwdriver' });
    // The Escape Pipe itself.
    q.fixtures.push({ id: 'escapePipe', kind: 'escapePipe', ...q._pt(3.0, 1.3, 0.24), label: 'Escape Pipe' });
    q.box(1.9, 0, 0.1, 2.2, 2.4, 0.18, 'metalDark', { tag: 'escapePipe' });
  });

  p.in('chestRoom', (q) => {
    // Four numbered chests -- three of them explode.
    for (let i = 0; i < 4; i++) {
      const lx = 0.35 + (i % 2) * 1.75, lz = 0.35 + ((i / 2) | 0) * 1.55;
      q.box(lx, 0, lz, 0.95, 0.62, 0.75, 'woodRaw');
      const lid = q.box(lx, 0.62, lz, 0.95, 0.1, 0.75, 'woodRaw');
      const rec = q._container(`chest:${i + 1}`, lid, lx + 0.47, 0.72, lz + 0.37, 'chest');
      rec.label = `Chest ${i + 1}`; rec.chestIndex = i + 1;
    }
  });

  p.in('elevator', (q) => {
    // Both side walls of the elevator are doorways, so the call button goes on
    // the back wall.
    q.fixtures.push({ id: 'elevatorButton', kind: 'elevatorButton', ...q._pt(1.0, 1.2, 0.24),
      label: 'Call the elevator' });
    q.box(0.86, 1.02, 0.06, 0.28, 0.28, 0.06, 'metalDark');
  });

  p.in('sewer', (q) => {
    q.pipes(0.5, 0.55, 4);
    q._container('sewer:stairWall', null, 4.2, 1.3, 0.2, 'shelf').label = 'Back wall of the staircase';
    q.fixtures.push({ id: 'wheelCrankGate', kind: 'wheelCrankGate', ...q._pt(4.85, 1.2, 1.6),
      label: 'Crank socket' });
  });

  p.in('sewerCell', (q) => {
    q.table({ side: 'N', t: 0.3, w: 1.1, d: 0.75, slot: 'sewerCell:table' });
    q.box(2.5, 0, 1.9, 0.5, 0.22, 1.2, 'gown', { solid: false, tint: 0xa8a498 });  // skeleton
    q._container('sewerCell:skeleton', null, 3.1, 0.18, 2.4, 'shelf').label = 'Next to the skeleton';
    q._container('sewerCell:corner', null, 0.35, 0.18, 2.6, 'shelf').label = 'Corner';
  });

  p.in('sewerDrain', (q) => { q.pipes(0.4, 0.45, 3, true); });
  p.in('wheelCrankTunnel', (q) => { q.crate({ side: 'N', t: 0.5, size: 0.5 }); });
  p.in('spiderEntrance', (q) => { q.crate({ side: 'W', t: 0.75, size: 0.55 }); });

  return p;
}
