// For debugging, mostly logging.
let DEBUG = true;

// Current mode, can be:
// - draw, for drawing with mouse
// - text, click to insert an input box and type
// - move, moving input box
let mode = '';

// The current url of the tab, used as a key to save and restore inputs and drawing.
let currentUrl = window.location.href;
// All the strokes drawn by the user, can be saved and restore.
let savedStrokes = [];
// List of inputs created and on-screen now.
let inputs = [];
// Set to the input that is currently being moved.
let movingInput;

// Debug logging, takes any number of arguments.
function debug() {
  if (!DEBUG) return;
  console.log(arguments);
}

// Data about a HTML Input element that we will save and restore.
class SavedInput {
  constructor(input) {
    this.value = input.value();
    // Note that x and y is relative to the window, not canvas.
    // In most cases this won't matter, but some websites like to dynamically load
    // content after this extesion has loaded, so our canvas might be offset
    // from window's (0,0).
    this.x = input.x;
    this.y = input.y;
    this.width = input.width;
    this.height = input.height;
  }
}

// Holds all the user data we can save and restore.
// Right now it is just all the text inputs and draw strokes.
class SavedData {
  constructor(inputs, strokes) {
    this.inputs = inputs;
    this.strokes = strokes;
  }

  restoreInput(sketch, savedInput) {
    let inp = sketch.createInput(savedInput.value);
    inp.position(savedInput.x, savedInput.y);
    inp.width = savedInput.width;
    inp.height = savedInput.height;
    inputs.push(inp);
  }

  restore(sketch) {
    let inputs = this.inputs;
    for (let input of inputs) {
      this.restoreInput(sketch, input);
    }
    savedStrokes = this.strokes;
    for (let stroke of savedStrokes) {
      sketch.line(stroke.x, stroke.y, stroke.px, stroke.py);
    }
  }
}

function getDataToSave() {
  return new SavedData(
    inputs.map(i => new SavedInput(i)), savedStrokes);
}

function saveAndDraw(sketch, x, y, px, py) {
  sketch.line(x, y, px, py);
  if (x != px && y != py) {
    savedStrokes.push({x, y, px, py});
  }
}

function saveData() {
  let data = {[currentUrl]: getDataToSave()};
  chrome.storage.local.set(data, function() {
    debug('saved: ', data);
  });
}

function restoreData(sketch) {
  chrome.storage.local.get([currentUrl], function(result) {
    let data = result[currentUrl];
    if (data === undefined) return;

    debug('restored: ', currentUrl, 'value: ', data);
    (new SavedData(data.inputs, data.strokes)).restore(sketch);
  });
}

// Use p5 instance mode.
var s = function(sketch) {
  sketch.setup = function() {
    // No selecting text when drawing.
    document.body.style['userSelect'] = 'none';
    let h = document.body.clientHeight;
    let c = sketch.createCanvas(sketch.windowWidth, sketch.windowHeight);
    c.position(0, 0);
    // Don't respond to pointer events.
    c.style('pointer-events', 'none');
    // Start with an empty canvas, hit 'r' to restore.
    // Maybe we can simply restore?
    sketch.clear();
  }

  sketch.draw = function() {
    sketch.stroke(0);
    sketch.strokeWeight(4);
    if (mode == 'draw') {
      if (sketch.mouseIsPressed) {
        saveAndDraw(sketch, sketch.mouseX, sketch.mouseY, sketch.pmouseX, sketch.pmouseY);
      }
    } else if (mode == 'text') {
      if (sketch.mouseIsPressed) {
        let inp = sketch.createInput('');
        inp.size(100);
        inp.position(sketch.mouseX, sketch.mouseY);
        inp.elt.focus();
        mode = '';
        inputs.push(inp);
      }
    } else if (mode == 'move') {
      if (movingInput === undefined) {
        console.error(' no input to move ');
      }
      let deltaX = sketch.mouseX - sketch.pmouseX;
      let deltaY = sketch.mouseY - sketch.pmouseY;
      movingInput.position(movingInput.x + deltaX, movingInput.y + deltaY);
    } else {
      // unknown key, ignore
    }
  }

  sketch.keyPressed = function() {
    if (sketch.keyCode === 84) {
      debug('text mode');
      // t, text mode
      mode = 'text';
    } else if (sketch.keyCode === 68) {
      debug('draw mode');
      // d, draw mode
      mode = 'draw';
    } else if (sketch.keyCode === 83) {
      // s, save
      if (chrome.storage === undefined || chrome.storage.local === undefined) return;
      saveData();
    } else if (sketch.keyCode === 82) {
      if (chrome.storage === undefined || chrome.storage.local === undefined) return;
      // r, restore
      restoreData(sketch);
    } else if (sketch.keyCode === 80) {
      // p, print saved strokes
      debug(savedStrokes);
    } else if (sketch.keyCode === 67) {
      // c, clear
      sketch.clear();
      savedStrokes = [];
      // TODO reset inputs.
    };
  }

  sketch.mousePressed = function() {
    let pressedX = sketch.mouseX;
    let pressedY = sketch.mouseY;
    // Check if any input is being moved.
    for (let input of inputs) {
      if (pressedX > input.x && pressedX < (input.x + input.width) &&
        pressedY > input.y && pressedY < (input.y + input.height)) {
        debug(input);
        mode = 'move'
        movingInput = input;
      }
    }
  }

  sketch.mouseReleased = function() {
    let releaseX = sketch.mouseX;
    let releaseY = sketch.mouseY;
    if (movingInput !== undefined) {
      // Stop moving input.
      movingInput = undefined;
      mode = '';
    }
  }
}


var myp5 = new p5(s);
