import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import "./App.css";
import { LabeledFaceDescriptors } from "face-api.js";

// Loads all labeled face descriptors
async function loadLabeledImages() {
  const labels = ['ankit', 'jitendra']; // add more as needed

  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];

      for (let i = 1; i <= 2; i++) { // two images per person
        const imgUrl = `/labeled_images/${label}/${i}.jpeg`;
        const img = await faceapi.fetchImage(imgUrl);

        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detections) {
          console.warn(`No face detected in image: ${imgUrl}`);
          continue;
        }

        descriptions.push(detections.descriptor);
      }

      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

interface DetectionOptions {
  faceDetection: boolean;
  landmarks: boolean;
  expressions: boolean;
  age: boolean;
  gender: boolean;
}

function App(): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [captureVideo, setCaptureVideo] = useState<boolean>(false);
  const [labeledFaceDescriptors, setLabeledFaceDescriptors] = useState<LabeledFaceDescriptors[]>([]);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [detectionResults, setDetectionResults] = useState<any[]>([]);
  const [detectionOptions, setDetectionOptions] = useState<DetectionOptions>({
    faceDetection: true,
    landmarks: false,
    expressions: false,
    age: false,
    gender: false,
  });
  const [statusMessage, setStatusMessage] = useState<string>("Loading models...");
  const [detectionInterval, setDetectionInterval] = useState<number | null>(null);
  const [leftTurn, setLeftTurn] = useState(0);
const [rightTurn, setRightTurn] = useState(0);
const [topTurn, setTopTurn] = useState(0);
const [bottomTurn, setBottomTurn] = useState(0);

const prevPositionRef = useRef({ x: 0, y: 0 }); // to store previous position

// Inside detection interval or wherever you are processing detections:
// const detectFaceMovement = async () => {
//   if (videoRef.current && modelsLoaded) {
//     const detections = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks();
//     if (detections) {
//       const box = detections.detection.box;
//       const currentPosition = { x: box.x, y: box.y };

//       const dx = currentPosition.x - prevPositionRef.current.x;
//       const dy = currentPosition.y - prevPositionRef.current.y;

//       const threshold = 20; // movement threshold to ignore small noise

//       if (dx > threshold) {
//         setRightTurn((prev) => prev + 1);
//       } else if (dx < -threshold) {
//         setLeftTurn((prev) => prev + 1);
//       }

//       if (dy > threshold) {
//         setBottomTurn((prev) => prev + 1);
//       } else if (dy < -threshold) {
//         setTopTurn((prev) => prev + 1);
//       }

//       // update previous position
//       prevPositionRef.current = currentPosition;
//     }
//   }
// };


const lastDirectionRef = useRef('');
const movementCooldown = useRef(false);
const cooldownTime = 800;

const positionHistory = useRef<{x: number, y: number}[]>([]);

const getSmoothedPosition = (newPos: {x: number, y: number}) => {
  positionHistory.current.push(newPos);
  if (positionHistory.current.length > 5) {
    positionHistory.current.shift(); // keep last 5 positions
  }

  const avgX = positionHistory.current.reduce((acc, pos) => acc + pos.x, 0) / positionHistory.current.length;
  const avgY = positionHistory.current.reduce((acc, pos) => acc + pos.y, 0) / positionHistory.current.length;

  return { x: avgX, y: avgY };
};


const detectFaceMovement = async () => {
  if (videoRef.current && modelsLoaded) {
    const detection = await faceapi
      .detectSingleFace(videoRef.current)
      .withFaceLandmarks();

    if (detection) {
      const box = detection.detection.box;

      // Smooth the current box position
      const smoothedPos = getSmoothedPosition({ x: box.x, y: box.y });

      // Calculate movement difference
      const dx = smoothedPos.x - prevPositionRef.current.x;
      const dy = smoothedPos.y - prevPositionRef.current.y;

      const threshold = 25;
      let direction = "";

      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > threshold ? "right" : dx < -threshold ? "left" : "";
      } else {
        direction = dy > threshold ? "down" : dy < -threshold ? "up" : "";
      }

      if (direction && !movementCooldown.current && direction !== lastDirectionRef.current) {
        lastDirectionRef.current = direction;
        movementCooldown.current = true;

        switch (direction) {
          case "right":
            setRightTurn((prev) => prev + 1);
            break;
          case "left":
            setLeftTurn((prev) => prev + 1);
            break;
          case "up":
            setTopTurn((prev) => prev + 1);
            break;
          case "down":
            setBottomTurn((prev) => prev + 1);
            break;
        }

        setTimeout(() => {
          movementCooldown.current = false;
        }, cooldownTime);
      }

      // Always update previous position with smoothed one
      prevPositionRef.current = smoothedPos;
    }
  }
};

    // Load face-api models
    const loadModels = async (): Promise<void> => {
      const MODEL_URL = "./models";
    
      try {
        setStatusMessage("Loading face detection models...");
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Added SsdMobilenetv1
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
        ]);
        console.log("Models loaded successfully!");
        setModelsLoaded(true);
        setStatusMessage('Models loaded! Click "Start Camera" to begin.');
      } catch (error) {
        setStatusMessage(
          `Error loading models: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        console.error("Error loading models:", error);
      }
    };
    useEffect(() => {
  
      loadModels();
  
      return () => {
        // Cleanup
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
  
        // Clear the detection interval if it exists
        if (detectionInterval) {
          clearInterval(detectionInterval);
        }
      };
    }, []);

  // Load labeled images for face recognition
  useEffect(() => {
    const initFaceRecognition = async () => {
      await loadModels();
      try {
        const descriptors = await loadLabeledImages();
        setLabeledFaceDescriptors(descriptors);
        
        if (descriptors.length > 0) {
          const matcher = new faceapi.FaceMatcher(descriptors, 0.6);
          setFaceMatcher(matcher);
          console.log("Face recognition data loaded successfully");
        }
      } catch (error) {
        console.error("Error loading labeled images:", error);
      }
    };
    
    initFaceRecognition();
  }, []);



  // Start video capture
  const startVideo = (): void => {
    if (!modelsLoaded) {
      setStatusMessage("Please wait for models to load...");
      return;
    }

    setCaptureVideo(true);
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatusMessage("Camera active. Detection running...");
      })
      .catch((err) => {
        setStatusMessage(
          `Error accessing camera: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        console.error("Error accessing camera:", err);
        setCaptureVideo(false);
      });
  };

  // Stop video capture
  const stopVideo = (): void => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      setCaptureVideo(false);
      setStatusMessage('Camera stopped. Click "Start Camera" to begin again.');

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }
      }

      // Clear detection interval
      if (detectionInterval) {
        clearInterval(detectionInterval);
        setDetectionInterval(null);
      }
      
      // Clear detection results
      setDetectionResults([]);
    }
  };

  // Run detection when video is playing AND models are loaded
  useEffect(() => {
    if (
      !captureVideo ||
      !videoRef.current ||
      !canvasRef.current ||
      !modelsLoaded
    )
      return;

    let intervalId: number;

    const runDetection = async () => {
      if (
        !videoRef.current ||
        !canvasRef.current ||
        videoRef.current.readyState !== 4
      ) {
        return;
      }

      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      // Store the canvas reference to a non-null variable after checking
      const canvas = canvasRef.current;
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        // Make sure the video is displayed in the canvas before detection
        ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

        let detectionChain: any = faceapi.detectAllFaces(
          canvas,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        );

        if (detectionOptions.landmarks || detectionOptions.faceDetection) {
          detectionChain = detectionChain.withFaceLandmarks();
        }
        
        // Add face descriptor extraction if we have labeled faces
        if (labeledFaceDescriptors.length > 0 && faceMatcher) {
          detectionChain = detectionChain.withFaceDescriptors();
        }
        
        if (detectionOptions.expressions) {
          detectionChain = detectionChain.withFaceExpressions();
        }
        
        if (detectionOptions.age || detectionOptions.gender) {
          detectionChain = detectionChain.withAgeAndGender();
        }

        const detections = await detectionChain;

        // Debug log to see if detections are being found
        console.log(`Detected ${detections.length} faces`);

        // Only clear the detection overlays, not the video
        const displaySize = { width: videoWidth, height: videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        // Scale detections to match display size
        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );

        // Clear previous drawings
        ctx.clearRect(0, 0, videoWidth, videoHeight);

        // Redraw the video frame
        ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

        // Create a new result list per run
        const newDetectionResults: any[] = [];

        // Process each detected face
        resizedDetections.forEach((detection: any, index: number) => {
          const { x, y, width, height } = detection.detection.box;
          const resultItem: any = {
            box: detection.detection.box,
          };

          // Calculate vertical position for text based on which options are enabled
          let textYOffset = 0;
          
          // Always draw the red rectangle for face detection
          if (detectionOptions.faceDetection && detection.detection) {
            faceapi.draw.drawDetections(canvas, resizedDetections);

            ctx.strokeStyle = "#FF0000";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            ctx.fillStyle = "#FF0000";
            ctx.font = "16px Arial";
            resultItem.faceDetected = true;
            
            // Try to identify the face if we have descriptors and matcher
            if (detection.descriptor && faceMatcher) {
              const match = faceMatcher.findBestMatch(detection.descriptor);
              ctx.fillText(`${match.label}`, x-50, y - 10);
              resultItem.label = match.label;
              resultItem.distance = match.distance;
            } else {
              ctx.fillText(`Face ${index + 1}`, x, y - 10);
            }
          }

          // Draw landmarks if enabled
          if (detectionOptions.landmarks && detection.landmarks) {
            faceapi.draw.drawFaceLandmarks(canvas, [detection]);
            resultItem.landmarks = true;

            ctx.font = "16px Arial";
            ctx.fillStyle = "#FF9800";
            ctx.fillText("Landmarks Detected", x+50, y - 5 - textYOffset);
            textYOffset += 20;
          }

          // Draw expressions if enabled
          if (detectionOptions.expressions && detection.expressions) {
            const dominant = Object.keys(detection.expressions).reduce((a, b) =>
              detection.expressions[a] > detection.expressions[b] ? a : b
            );
            const expressionText = `${
              dominant.charAt(0).toUpperCase() + dominant.slice(1)
            } (${Math.round(detection.expressions[dominant] * 100)}%)`;

            resultItem.expressions = detection.expressions;
            resultItem.dominantExpression = dominant;

            ctx.font = "16px Arial";
            ctx.fillStyle = "#4CAF50";
            ctx.fillText(expressionText, x, y - 10 - textYOffset);
            textYOffset += 20;
          }

          // Draw age and gender if enabled
          if (
            (detectionOptions.age || detectionOptions.gender) &&
            (detection.age !== undefined || detection.gender !== undefined)
          ) {
            let demographicText = "";

            if (detectionOptions.age && detection.age !== undefined) {
              demographicText += `Age: ${Math.round(detection.age)} `;
              resultItem.age = Math.round(detection.age);
            }

            if (detectionOptions.gender && detection.gender !== undefined) {
              demographicText += `Gender: ${detection.gender} (${Math.round(
                detection.genderProbability * 100
              )}%)`;
              resultItem.gender = detection.gender;
              resultItem.genderProbability = Math.round(
                detection.genderProbability * 100
              );
            }

            ctx.font = "16px Arial";
            ctx.fillStyle = "#2196F3";
            ctx.fillText(demographicText, x, y - 10 - textYOffset);
          }

          // Add this detection to results
          newDetectionResults.push(resultItem);
        });

        // Replace old detection result with the new one
        setDetectionResults(newDetectionResults);
      } catch (error) {
        console.error("Detection error:", error);
      }
    };

    intervalId = window.setInterval(()=> {
      detectFaceMovement(); // Call the face movement detection function
      runDetection(); 
    }, 100);
    setDetectionInterval(intervalId);

    return () => {
      clearInterval(intervalId);
    };
  }, [captureVideo, detectionOptions, modelsLoaded, labeledFaceDescriptors, faceMatcher]);

  // Toggle detection options
  const toggleOption = (option: keyof DetectionOptions): void => {
    setDetectionOptions((prev) => {
      const updated = {
        ...prev,
        [option]: !prev[option],
      };
      console.log(`Option ${option} toggled to ${!prev[option]}`);
      return updated;
    });
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Client-Side Face Recognition</h1>
        <p className="app-subtitle">Real-time facial analysis with FaceAPI.js</p>
      </div>

      <div className="app-container">
        <div className="video-wrapper">
          <div className="video-container">
            <video
              ref={videoRef}
              width="640"
              height="480"
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="detection-canvas" />
            {!captureVideo && (
              <div className="video-overlay">
                <div className="overlay-content">
                  {modelsLoaded ? (
                    <>
                      <div className="camera-icon">📷</div>
                      <button className="start-button" onClick={startVideo}>
                        Start Camera
                      </button>
                    </>
                  ) : (
                    <div className="loading-indicator">
                      <div className="spinner"></div>
                      <p>Loading models...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* show details here */}
          {captureVideo && (
            <div className="video-details">
              <h3>Video Stream Active</h3>
              <p>Face detection and analysis in progress...</p>
              <ul>
                {detectionResults.map((det, index) => (
                  <li key={index}>
                    <strong>{det.label || `Person ${index + 1}`}</strong>
                    <br />
                    {det.age && (
                      <span>
                        🧍 Age: {Math.round(det.age)}
                        <br />
                      </span>
                    )}
                    {det.gender && (
                      <span>
                        ⚧️ Gender: {det.gender} ({det.genderProbability}%)
                        <br />
                      </span>
                    )}
                    {det.dominantExpression && (
                      <span>
                        😄 Expression: {det.dominantExpression}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
  <p>Left: {leftTurn}</p>
  <p>Right: {rightTurn}</p>
  <p>Top: {topTurn}</p>
  <p>Bottom: {bottomTurn}</p>
</div>

        </div>

        <div className="controls-panel">
          <div className="panel-header">
            <h2>Detection Controls</h2>
            <div className="status-badge">{statusMessage}</div>
          </div>

          <div className="options-grid">
            <div
              className={`option-card ${
                detectionOptions.faceDetection ? "active" : ""
              }`}
            >
              <div className="option-icon">🔍</div>
              <div className="option-content">
                <h3>Face Detection</h3>
                <p>Detect faces in video</p>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={detectionOptions.faceDetection}
                    onChange={() => toggleOption("faceDetection")}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div
              className={`option-card ${
                detectionOptions.landmarks ? "active" : ""
              }`}
            >
              <div className="option-icon">👁️</div>
              <div className="option-content">
                <h3>Facial Landmarks</h3>
                <p>Detect facial features</p>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={detectionOptions.landmarks}
                    onChange={() => toggleOption("landmarks")}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div
              className={`option-card ${
                detectionOptions.expressions ? "active" : ""
              }`}
            >
              <div className="option-icon">😀</div>
              <div className="option-content">
                <h3>Expressions</h3>
                <p>Analyze facial expressions</p>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={detectionOptions.expressions}
                    onChange={() => toggleOption("expressions")}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div
              className={`option-card ${detectionOptions.age ? "active" : ""}`}
            >
              <div className="option-icon">📊</div>
              <div className="option-content">
                <h3>Age Estimation</h3>
                <p>Estimate age range</p>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={detectionOptions.age}
                    onChange={() => toggleOption("age")}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div
              className={`option-card ${
                detectionOptions.gender ? "active" : ""
              }`}
            >
              <div className="option-icon">👤</div>
              <div className="option-content">
                <h3>Gender Detection</h3>
                <p>Detect probable gender</p>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={detectionOptions.gender}
                    onChange={() => toggleOption("gender")}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          </div>

          {captureVideo && (
            <div className="action-bar">
              <button className="stop-button" onClick={stopVideo}>
                Stop Camera
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;