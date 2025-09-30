// centers 
// 0 - top (white)
// 1 - left (orange)
// 2 - front (green)
// 3 - right (red)
// 4 - back (blue)
// 5 - bottom (yellow)
// 


// https://github.com/cubing/cubing.js/blob/main/src/cubing/twisty/views/3D/puzzles/Cube3D.ts#L368

// trl 2  trr 1 
// tfl 3  ftr 0 

// brl 6  brr 7
// bfl 5  bfr 4 

const colors = [
  "white", 
  "green",
  "orange",
  "blue",
  "red",
  "yellow",
];
const W = 0;
const G = 1;
const O = 2;
const B = 3;
const R = 4;
const Y = 5;

const corner_stickers = [
  [W, R, G],
  [W, B, R],
  [W, O, B],
  [W, G, O],
  [Y, G, R],
  [Y, O, G],
  [Y, B, O],
  [Y, R, B],
];


import './style.css'

import $ from 'jquery';
import { Subscription, interval } from 'rxjs';
import { TwistyPlayer } from 'cubing/twisty';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';

import * as THREE from 'three';

import {
  now,
  connectGanCube,
  GanCubeConnection,
  GanCubeEvent,
  GanCubeMove,
  MacAddressProvider,
  makeTimeFromTimestamp,
  cubeTimestampCalcSkew,
  cubeTimestampLinearFit
} from 'gan-web-bluetooth';

import { faceletsToPattern, patternToFacelets } from './utils';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

var twistyPlayer = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: 'PG3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  hintFacelets: 'none',
  experimentalDragInput: 'none',
  cameraLatitude: 0,
  cameraLongitude: 0,
  cameraLatitudeLimit: 0,
  tempoScale: 5
});

$('#cube').append(twistyPlayer);

var conn: GanCubeConnection | null;
var lastMoves: GanCubeMove[] = [];
var solutionMoves: GanCubeMove[] = [];

var twistyScene: THREE.Scene;
var twistyVantage: any;

const faceletsToColor = {
  U: "FFFFFF",  // while
  F: "008F00",
  L: "FFA500",
  B: "0000FF",
  R: "FF0000",
  D: "FFFF00",
};

const facesToLedRanges = [
  [0, 0, 0],
  [0, 1, 1],
  [0, 2, 2],
  [0, 8, 8],
  [0, 9, 9],
  [0, 10, 10],
  [0, 16, 16],
  [0, 17, 17],
  [0, 18, 18],

  [0, 21, 21],
  [0, 13, 13],
  [0, 5, 5],
  [0, 22, 22],
  [0, 14, 14],
  [0, 6, 6],
  [0, 23, 23],
  [0, 15, 15],
  [0, 7, 7],

  [0, 40, 40],
  [0, 41, 41],
  [0, 42, 42],
  [0, 48, 48],
  [0, 49, 49],
  [0, 50, 50],
  [0, 56, 56],
  [0, 57, 57],
  [0, 58, 58],

  [0, 61, 61],
  [0, 62, 62],
  [0, 63, 63],
 
  [0, 53, 53],
  [0, 54, 54],
  [0, 55, 55],

  [0, 45, 45],
  [0, 46, 46],
  [0, 47, 47],

  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,

  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
];

const blankRanges = [
  [3,5],
  [11,13],
  [19,21],
  [24,40],
  [43,45],
  [51,53],
  [59,61],
];

let onOff = true;
let brightness = 50;


async function renderCubeStateAsync(patternData) {
  const segments = [];

  if (patternData) {
    const facelets = patternToFacelets(patternData);
    console.log(facelets);
  
    for (let idx = 0; idx < facelets.length; idx ++) {
      if (facesToLedRanges[idx]) {
        const faceSegment = facesToLedRanges[idx];
        segments.push(faceSegment[1]);
        segments.push(faceSegment[2]);
        segments.push(faceletsToColor[facelets[idx]]);
      }
    }
    for (const blank of blankRanges) {
      segments.push(blank[0]);
      segments.push(blank[1]);
      segments.push("000000");
    }
  }
  // const data = [{"seg":{"i":[0,8,"FF0000",10,18,"0000FF"]}}, {"seg":{"i":[0,8,"000000",10,18,"FF0000"]}}][i % 2];
  const data = {"seg":{"i":segments},
    "on": onOff,
    "bri": brightness};
  $.ajax({
    method: 'post',
    url: 'http://192.168.5.183/json/state',
    contentType: 'application/json',
    data: JSON.stringify(data),
    dataType: 'json',
  });
}

const HOME_ORIENTATION = new THREE.Quaternion().setFromEuler(new THREE.Euler(15 * Math.PI / 180, -20 * Math.PI / 180, 0));
var cubeQuaternion: THREE.Quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0));

async function amimateCubeOrientation() {
  if (!twistyScene || !twistyVantage) {
    var vantageList = await twistyPlayer.experimentalCurrentVantages();
    twistyVantage = [...vantageList][0];
    twistyScene = await twistyVantage.scene.scene();
  }
  twistyScene.quaternion.slerp(cubeQuaternion, 0.25);
  twistyVantage.render();
  requestAnimationFrame(amimateCubeOrientation);
}
requestAnimationFrame(amimateCubeOrientation);

var basis: THREE.Quaternion | null;

async function handleGyroEvent(event: GanCubeEvent) {
  if (event.type == "GYRO") {
    let { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
    let quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();
    if (!basis) {
      basis = quat.clone().conjugate();
    }
    cubeQuaternion.copy(quat.premultiply(basis).premultiply(HOME_ORIENTATION));
    $('#quaternion').val(`x: ${qx.toFixed(3)}, y: ${qy.toFixed(3)}, z: ${qz.toFixed(3)}, w: ${qw.toFixed(3)}`);
    if (event.velocity) {
      let { x: vx, y: vy, z: vz } = event.velocity;
      $('#velocity').val(`x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }
}

let i = 0;

async function handleMoveEvent(event: GanCubeEvent) {
  if (event.type == "MOVE") {
    if (timerState == "READY") {
      setTimerState("RUNNING");
    }
    i ++;
    // const data = [{"seg":{"i":[0,8,"FF0000",10,18,"0000FF"]}}, {"seg":{"i":[0,8,"000000",10,18,"FF0000"]}}][i % 2];
    // $.ajax({
    //   method: 'post',
    //   url: 'http://192.168.5.183/json/state',
    //   contentType: 'application/json',
    //   data: JSON.stringify(data),
    //   dataType: 'json',
    // });
    twistyPlayer.experimentalAddMove(event.move, { cancel: false });
    // console.log(twistyPlayer);
    // console.log('twistyPlayer.experimentalModel',twistyPlayer.experimentalModel);
    await renderCubeStateAsync(await twistyPlayer.experimentalModel.currentPattern.get());
    //console.log('CO',(await twistyPlayer.experimentalModel.currentPattern.get()).patternData.CORNERS.orientation);
    //console.log('CP',(await twistyPlayer.experimentalModel.currentPattern.get()).patternData.CORNERS.pieces);
    // console.log('twistyPlayer.experimentalModel',(await twistyPlayer.experimentalModel.currentPattern.get()).patternData);
    lastMoves.push(event);
    if (timerState == "RUNNING") {
      solutionMoves.push(event);
    }
    if (lastMoves.length > 256) {
      lastMoves = lastMoves.slice(-256);
    }
    if (lastMoves.length > 10) {
      var skew = cubeTimestampCalcSkew(lastMoves);
      $('#skew').val(skew + '%');
    }
  }
}

var cubeStateInitialized = false;

async function handleFaceletsEvent(event: GanCubeEvent) {
  if (event.type == "FACELETS" && !cubeStateInitialized) {
    if (event.facelets != SOLVED_STATE) {
      var kpattern = faceletsToPattern(event.facelets);
      var solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
      console.log(solution)
      var scramble = solution.invert();
      twistyPlayer.alg = scramble;
    } else {
      twistyPlayer.alg = '';
    }
    cubeStateInitialized = true;
    console.log("Initial cube state is applied successfully", event.facelets);
  }
}

function handleCubeEvent(event: GanCubeEvent) {
  
  if (event.type != "GYRO")
    console.log("GanCubeEvent", event);
  // else
  //   console.log("gyro", event);
  if (event.type == "GYRO") {
    handleGyroEvent(event);
  } else if (event.type == "MOVE") {
    handleMoveEvent(event);
  } else if (event.type == "FACELETS") {
    handleFaceletsEvent(event);
  } else if (event.type == "HARDWARE") {
    $('#hardwareName').val(event.hardwareName || '- n/a -');
    $('#hardwareVersion').val(event.hardwareVersion || '- n/a -');
    $('#softwareVersion').val(event.softwareVersion || '- n/a -');
    $('#productDate').val(event.productDate || '- n/a -');
    $('#gyroSupported').val(event.gyroSupported ? "YES" : "NO");
  } else if (event.type == "BATTERY") {
    $('#batteryLevel').val(event.batteryLevel + '%');
  } else if (event.type == "DISCONNECT") {
    twistyPlayer.alg = '';
    $('.info input').val('- n/a -');
    $('#connect').html('Connect');
  }
}

const customMacAddressProvider: MacAddressProvider = async (device, isFallbackCall): Promise<string | null> => {
  if (isFallbackCall) {
    return prompt('Unable do determine cube MAC address!\nPlease enter MAC address manually:','E6:EA:C7:CB:D6:6F');
  } else {
    return typeof device.watchAdvertisements == 'function' ? null :
      prompt('Seems like your browser does not support Web Bluetooth watchAdvertisements() API. Enable following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features\n\nor enter cube MAC address manually:');
  }
};

$('#reset-state').on('click', async () => {
  await conn?.sendCubeCommand({ type: "REQUEST_RESET" });
  twistyPlayer.alg = '';
});

$('#reset-gyro').on('click', async () => {
  basis = null;
});

$('#connect').on('click', async () => {
  if (conn) {
    conn.disconnect();
    conn = null;
  } else {
    conn = await connectGanCube(customMacAddressProvider);
    conn.events$.subscribe(handleCubeEvent);
    await conn.sendCubeCommand({ type: "REQUEST_HARDWARE" });
    await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    await conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
    $('#deviceName').val(conn.deviceName);
    $('#deviceMAC').val(conn.deviceMAC);
    $('#connect').html('Disconnect');
  }
});

var timerState: "IDLE" | "READY" | "RUNNING" | "STOPPED" = "IDLE";

function setTimerState(state: typeof timerState) {
  timerState = state;
  switch (state) {
    case "IDLE":
      stopLocalTimer();
      $('#timer').hide();
      break;
    case 'READY':
      setTimerValue(0);
      $('#timer').show();
      $('#timer').css('color', '#0f0');
      break;
    case 'RUNNING':
      solutionMoves = [];
      startLocalTimer();
      $('#timer').css('color', '#999');
      break;
    case 'STOPPED':
      stopLocalTimer();
      $('#timer').css('color', '#fff');
      var fittedMoves = cubeTimestampLinearFit(solutionMoves);
      var lastMove = fittedMoves.slice(-1).pop();
      setTimerValue(lastMove ? lastMove.cubeTimestamp! : 0);
      break;
  }
}
console.log('twistyPlayer.experimentalModel',twistyPlayer.experimentalModel);
twistyPlayer.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  var facelets = patternToFacelets(kpattern);
  if (facelets == SOLVED_STATE) {
    if (timerState == "RUNNING") {
      setTimerState("STOPPED");
    }
    twistyPlayer.alg = '';
  }
});

function setTimerValue(timestamp: number) {
  let t = makeTimeFromTimestamp(timestamp);
  $('#timer').html(`${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`);
}

var localTimer: Subscription | null = null;
function startLocalTimer() {
  var startTime = now();
  localTimer = interval(30).subscribe(() => {
    setTimerValue(now() - startTime);
  });
}

function stopLocalTimer() {
  localTimer?.unsubscribe();
  localTimer = null;
}

function activateTimer() {
  if (timerState == "IDLE" && conn) {
    setTimerState("READY");
  } else {
    setTimerState("IDLE");
  }
}

$(document).on('keydown', (event) => {
  if (event.which == 32) {
    event.preventDefault();
    activateTimer();
  }
});

$("#cube").on('touchstart', () => {
  activateTimer();
});

$("#onOff").on('click', async () => {
  onOff = !onOff;
  if (cubeStateInitialized) {
    await renderCubeStateAsync(await twistyPlayer.experimentalModel.currentPattern.get());
  } else {
    await renderCubeStateAsync();
  }
  $('#onOff').html(onOff ? 'LED off' : 'LED on');
});
