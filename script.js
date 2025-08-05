const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const logBtn = document.getElementById('logBtn');
const repCountEl = document.getElementById('repCount');
const feedbackEl = document.getElementById('feedback');
const exerciseSelect = document.getElementById('exerciseSelect');
const historyList = document.getElementById('historyList');

let repCount = 0;
let direction = 'down';
let isModelLoaded = false;
let model;

async function loadModel() {
  try {
    model = await movenet.load({
      modelType: movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
    isModelLoaded = true;
    feedbackEl.textContent = "Model loaded. Click 'Start Camera' to begin.";
  } catch (error) {
    feedbackEl.textContent = "Failed to load AI model.";
    console.error(error);
  }
}

async function startCamera() {
  if (!isModelLoaded) {
    feedbackEl.textContent = "Model still loading...";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    startBtn.disabled = true;
    logBtn.disabled = false;
    exerciseSelect.disabled = true;

    video.onloadedmetadata = () => {
      detectPose();
    };
  } catch (err) {
    feedbackEl.textContent = "Camera access denied or not available.";
    console.error(err);
  }
}

async function detectPose() {
  if (!isModelLoaded) return;

  let poses = [];
  try {
    const { keypoints } = await model.estimatePoses(video);
    poses = keypoints;
  } catch (err) {
    console.warn("Pose estimation failed:", err);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (poses.length > 0) {
    drawSkeleton(poses);
    countReps(poses, exerciseSelect.value);
  }

  requestAnimationFrame(detectPose);
}

function drawSkeleton(keypoints) {
  keypoints.forEach(kp => {
    if (kp.score > 0.3) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    }
  });

  const connections = [
    [5, 7], [7, 9],
    [6, 8], [8, 10],
    [5, 6], [5, 11], [6, 12],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
  ];

  connections.forEach(([i, j]) => {
    const a = keypoints[i];
    const b = keypoints[j];
    if (a.score > 0.3 && b.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

function countReps(keypoints, exercise) {
  let angle = 0;
  let thresholdUp = 160;
  let thresholdDown = 90;

  if (exercise === 'squats') {
    const leftKnee = keypoints[13];
    const leftHip = keypoints[11];
    const leftAnkle = keypoints[15];
    angle = getAngle(leftHip, leftKnee, leftAnkle);
    thresholdUp = 170;
    thresholdDown = 100;
  } else if (exercise === 'bicep-curls') {
    const leftShoulder = keypoints[5];
    const leftElbow = keypoints[7];
    const leftWrist = keypoints[9];
    angle = getAngle(leftShoulder, leftElbow, leftWrist);
    thresholdUp = 170;
    thresholdDown = 30;
  } else if (exercise === 'pushups' || exercise === 'situps') {
    const leftShoulder = keypoints[5];
    const leftHip = keypoints[11];
    const leftKnee = keypoints[13];
    const hipY = (leftShoulder.y + leftHip.y) / 2;
    const kneeY = leftKnee.y;
    angle = hipY - kneeY;
    thresholdUp = 50;
    thresholdDown = -20;
  }

  if (exercise === 'pushups' || exercise === 'situps') {
    if (angle > thresholdUp && direction === 'down') {
      direction = 'up';
    } else if (angle < thresholdDown && direction === 'up') {
      repCount++;
      repCountEl.textContent = repCount;
      feedbackEl.textContent = `Rep counted! Total: ${repCount}`;
      direction = 'down';
    }
  } else {
    if (angle > thresholdUp && direction === 'down') {
      direction = 'up';
    } else if (angle < thresholdDown && direction === 'up') {
      repCount++;
      repCountEl.textContent = repCount;
      feedbackEl.textContent = `Rep counted! Total: ${repCount}`;
      direction = 'down';
    }
  }
}

function getAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = radians * 180 / Math.PI;
  return Math.abs(degrees > 180 ? 360 - degrees : degrees);
}

function logWorkout() {
  const now = new Date();
  const entry = {
    exercise: exerciseSelect.value,
    reps: repCount,
    timestamp: now.toLocaleString(),
    date: now.toISOString().split('T')[0]
  };

  const history = JSON.parse(localStorage.getItem('workouts') || '[]');
  history.push(entry);
  localStorage.setItem('workouts', JSON.stringify(history));

  const li = document.createElement('li');
  li.textContent = `${entry.timestamp} – ${formatExerciseName(entry.exercise)}: ${entry.reps} reps`;
  historyList.appendChild(li);

  repCount = 0;
  repCountEl.textContent = '0';
  feedbackEl.textContent = 'Workout logged! Ready for next set.';
}

function formatExerciseName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function loadHistory() {
  const history = JSON.parse(localStorage.getItem('workouts') || '[]');
  history.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.timestamp} – ${formatExerciseName(entry.exercise)}: ${entry.reps} reps`;
    historyList.appendChild(li);
  });
}

startBtn.addEventListener('click', startCamera);
logBtn.addEventListener('click', logWorkout);

loadModel().then(() => {
  loadHistory();
});
