"use strict";

const heartRateMonitor = (function () {
	////////////////////////////////////HELPERS////////////////////////////////////

// Helper function to calculate the percentile of an array
 const percentile = (arr, p) => {
    arr.sort((a, b) => a - b);
    const index = Math.floor((p / 100) * (arr.length - 1));
    return arr[index];
};

// Function to remove outliers using the IQR method
 const removeOutliersIQR = (data, factor = 1.5) => {
    const Q1 = percentile(data, 25);
    const Q3 = percentile(data, 75);
    const IQR = Q3 - Q1;
    const lowerBound = Q1 - factor * IQR;
    const upperBound = Q3 + factor * IQR;

    let outliers = 0;
	// Calculate the mean of the data (including outliers initially)
    const mean = data.reduce((acc, value) => acc + value, 0) / data.length;
	// Log the mean to make sure it's valid
    //console.log("Calculated mean:", mean);
	
    const cleanedData = data.map(value => {
        if (value >= lowerBound && value <= upperBound) {
            return value;
        } else {
            outliers++;
            return mean;
        }
    });

    console.log(`Number of outliers removed: ${outliers}`);
    return cleanedData;
};

// Function to apply a moving average filter to smooth the data
 const movingAverage = (data, windowSize) => {
    const result = [];
    for (let i = 0; i < data.length - windowSize + 1; i++) {
        result.push(data.slice(i, i + windowSize).reduce((acc, val) => acc + val, 0) / windowSize);
    }
    return result;
};

// Function to detect peaks (local maxima) in the data
 const findPeaks = (data, height = 0.55, distance = 3, prominence = 0.02) => {
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] >= height) {
            const left = Math.max(...data.slice(i - distance, i));
            const right = Math.max(...data.slice(i + 1, i + 1 + distance));
            if (data[i] > left + prominence && data[i] > right + prominence) {
                peaks.push(i);
            }
        }
    }
    return peaks;
};

// Function to calculate heart rate (BPM) from peak intervals
 const calculateHeartRate = (peaks, frameRate = 60) => {
    const timeInterval = 1 / frameRate;
    const peakTimes = peaks.map(i => i * timeInterval); // Convert peak indices to time in seconds

    const timeIntervals = peakTimes.slice(1).map((time, i) => time - peakTimes[i]);
    const heartRates = timeIntervals.map(interval => 60 / interval); // BPM = 60 / time interval in seconds

    return heartRates;
};

// Function to get the calculated heart rate
const getHeartRate = (heartRates) => {
    const averageHeartRate = heartRates.reduce((acc, bpm) => acc + bpm, 0) / heartRates.length;
    console.log(`Detected heart rate: ${averageHeartRate.toFixed(2)} BPM`);

    heartRates.forEach((bpm, i) => {
        console.log(`Interval ${i + 1}: ${bpm.toFixed(2)} BPM`);
    });
    return averageHeartRate
};

////////////////////////////////////!HELPERS////////////////////////////////////

	const breathingCircle = document.getElementById("breathing-circle");

	function startBreathingAnimation() {
		breathingCircle.style.animationPlayState = "running";
	}

	function stopBreathingAnimation() {
		breathingCircle.style.animationPlayState = "paused";
	}
	
	// Size of sampling image
	const IMAGE_WIDTH = 30;
	const IMAGE_HEIGHT = 30;

	// Array of measured samples
	const SAMPLE_BUFFER = [];

	const BRIGHTNESS_BUFFER_SIZE = 30; // About half a second at 60fps
	let brightnessBuffer = [];

	// Max 5 seconds of samples (at 60 samples per second)
	// Measurement isn't dependant on frame rate but the visual speed of the graph is
	const MAX_SAMPLES = 60 * 5;

	// How long to wait in milliseconds for the camera image to stabilize before starting measurement
	const START_DELAY = 1500;

	// Callback for reporting the measured heart rate
	let ON_BPM_CHANGE;

	// The <video> element for streaming the camera feed into
	let VIDEO_ELEMENT;

	// Canvas element for sampling image data from the video stream
	let SAMPLING_CANVAS;

	// Sampling canvas 2d context
	let SAMPLING_CONTEXT;

	// Canvas element for the graph
	let GRAPH_CANVAS;

	// Graph canvas 2d context
	let GRAPH_CONTEXT;

	// Color of the graph line
	let GRAPH_COLOR;

	// Width of the graph line
	let GRAPH_WIDTH;

	// Whether to print debug messages
	let DEBUG = false;

	// Video stream object
	let VIDEO_STREAM;

	let MONITORING = false;

	// Debug logging
	const log = (...args) => {
		if (DEBUG) {
			console.log(...args);
			document.querySelector("#debug-log").innerHTML += args + "<br />";
		}
	};

	// Publicly available methods & variables
	const publicMethods = {};
	// Function to check if the user's finger placement is correct and stable
	function checkFingerPlacement(canvas, context) {
		// Calculate the average brightness using your existing function
		const brightness = averageBrightness(canvas, context);

		// Add the current brightness to the buffer
		brightnessBuffer.push(brightness);
		if (brightnessBuffer.length > BRIGHTNESS_BUFFER_SIZE) {
			brightnessBuffer.shift(); // Remove the oldest value to maintain buffer size
		}

		// Set thresholds for feedback based on average brightness level
		const minBrightness = 0.1;
		const maxBrightness = 0.6;

		// Check if brightness is within a good range
		if (brightness < minBrightness) {
			showFeedbackMessage("Pressing too hard, lighten your touch.");
		} else if (brightness > maxBrightness) {
			showFeedbackMessage("Cover the camera fully with your finger.");
		} else {
			// Check for stability if brightness is in the correct range
			const stability = calculateStability(brightnessBuffer);
			if (stability > 0.02) { // Adjust this threshold as needed
				showFeedbackMessage("Hold steady, finger is moving too much.");
			} else {
				showFeedbackMessage("Perfect! Hold steady for accurate readings.");
			}
		}
	}

	// Function to calculate the standard deviation of brightness values in the buffer
	function calculateStability(buffer) {
		const mean = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
		const variance = buffer.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / buffer.length;
		return Math.sqrt(variance);
	}

	// Get an average brightness reading
	const averageBrightness = (canvas, context) => {
		// 1d array of r, g, b, a pixel data values
		const pixelData = context.getImageData(
			0,
			0,
			canvas.width,
			canvas.height
		).data;
		let sum = 0;

		// Only use the red and green channels as that combination gives the best readings
		for (let i = 0; i < pixelData.length; i += 4) {
			sum = sum + pixelData[i] + pixelData[i + 1];
		}

		// Since we only process two channels out of four we scale the data length to half
		const avg = sum / (pixelData.length * 0.5);

		// Scale to 0 ... 1
		return avg / 255;
	};

	function showFeedbackMessage(message) {
		const feedbackElement = document.getElementById('feedback');
		feedbackElement.textContent = message;
		feedbackElement.style.color = "#007BFF"; // Optional: Change color for better visibility
	}

	publicMethods.initialize = (configuration) => {
		VIDEO_ELEMENT = configuration.videoElement;
		SAMPLING_CANVAS = configuration.samplingCanvas;
		GRAPH_CANVAS = configuration.graphCanvas;
		GRAPH_COLOR = configuration.graphColor;
		GRAPH_WIDTH = configuration.graphWidth;
		ON_BPM_CHANGE = configuration.onBpmChange;
		SAMPLING_CONTEXT = SAMPLING_CANVAS.getContext("2d");
		GRAPH_CONTEXT = GRAPH_CANVAS.getContext("2d");

		if (!"mediaDevices" in navigator) {
			// TODO: use something nicer than an alert
			alert(
				"Sorry, your browser doesn't support camera access which is required by this app."
			);
			return false;
		}

		// Setup event listeners
		window.addEventListener("resize", handleResize);

		// Set the canvas size to its element size
		handleResize();
	};

	const handleResize = () => {
		log(
			"handleResize",
			GRAPH_CANVAS.clientWidth,
			GRAPH_CANVAS.clientHeight
		);
		GRAPH_CANVAS.width = GRAPH_CANVAS.clientWidth;
		GRAPH_CANVAS.height = GRAPH_CANVAS.clientHeight;
	};

	publicMethods.toggleMonitoring = () => {
		if (MONITORING) {
			stopMonitoring();
			stopBreathingAnimation();
		} else {
			startMonitoring();
			startBreathingAnimation();
		}
	};

	const getCamera = async () => {
		const devices = await navigator.mediaDevices.enumerateDevices();
		const cameras = devices.filter(
			(device) => device.kind === "videoinput"
		);
		return cameras[cameras.length - 1];
	};



	const startMonitoring = async () => {
		resetBuffer();
		handleResize();
		setBpmDisplay("");

		const camera = await getCamera();
		VIDEO_STREAM = await startCameraStream(camera);

		if (!VIDEO_STREAM) {
			throw Error("Unable to start video stream");
		}

		try {
			setTorchStatus(VIDEO_STREAM, true);
		} catch (e) {
			alert("Error:" + e);
		}

		SAMPLING_CANVAS.width = IMAGE_WIDTH;
		SAMPLING_CANVAS.height = IMAGE_HEIGHT;
		VIDEO_ELEMENT.srcObject = VIDEO_STREAM;
		VIDEO_ELEMENT.play();
		MONITORING = true;

		// Waiting helps stabilaze the camera image before taking samples
		log("Waiting before starting mainloop...");
		setTimeout(async () => {
			log("Starting mainloop...");
			monitorLoop();
		}, START_DELAY);
	};

	const stopMonitoring = async () => {
		setTorchStatus(VIDEO_STREAM, false);
		VIDEO_ELEMENT.pause();
		VIDEO_ELEMENT.srcObject = null;
		MONITORING = false;
	};

	const monitorLoop = () => {
		processFrame();
		if (MONITORING) {
			window.requestAnimationFrame(monitorLoop);
		}
	};

	const resetBuffer = () => {
		SAMPLE_BUFFER.length = 0;
	};

	const startCameraStream = async (camera) => {
		// At this point the browser asks for permission
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: camera.deviceId,
					facingMode: ["user", "environment"],
					width: { ideal: IMAGE_WIDTH },
					height: { ideal: IMAGE_HEIGHT },

					// Experimental:
					whiteBalanceMode: "manual",
					exposureMode: "manual",
					focusMode: "manual",
				},
			});
		} catch (error) {
			alert("Failed to access camera!\nError: " + error.message);
			return;
		}

		return stream;
	};

	const setTorchStatus = async (stream, status) => {
		// Try to enable flashlight
		try {
			const track = stream.getVideoTracks()[0];
			await track.applyConstraints({
				advanced: [{ torch: status }],
			});
		} catch (error) {
			alert("Starting torch failed.\nError: " + error.message);
		}
	};

	const setBpmDisplay = (bpm) => {
		ON_BPM_CHANGE(bpm);
	};

	function saveDataAsJson() {
		// Get the current date and time
		const now = new Date();
		
		// Format the timestamp (e.g., "2024-11-08_14-30-45")
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
		
		// Create the JSON data
		const jsonData = JSON.stringify(SAMPLE_BUFFER, null, 2);
		
		// Create a blob and a download link
		const blob = new Blob([jsonData], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		
		// Set the filename with the timestamp
		a.href = url;
		a.download = `heart_rate_data_${timestamp}.json`;
		
		// Trigger the download
		document.body.appendChild(a);
		a.click();
		
		// Clean up
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	const processHeartRateData = (sampleBuffer) => {
		// Step 1: Extract values from SAMPLE_BUFFER
		const dataValues = sampleBuffer.map(sample => sample.value);
	
		// Step 2: Remove outliers using IQR method
		const cleanedData = removeOutliersIQR(dataValues, 1.5);
	
		// Step 3: Smooth the data with a moving average filter (optional)
		const smoothedData = movingAverage(cleanedData, 3);
	
		// Step 4: Detect peaks in the smoothed data
		const peaks = findPeaks(smoothedData, 0.55, 3, 0.02);
	
		// Step 5: Calculate the heart rate (BPM)
		const heartRates = calculateHeartRate(peaks, 60);
	
		// Step 6: Display the heart rate
		const bpm = getHeartRate(heartRates);
	
		// Step 7: Create a dataStats object for graphing (for scaling)
		const dataStats = {
			min: Math.min(...smoothedData),
			max: Math.max(...smoothedData)
		};
	
		// Return processed data and stats
		return { smoothedData, peaks, bpm, dataStats };
	};
	
	
	
	const processFrame = () => {
		// Draw the current video frame onto the canvas
		SAMPLING_CONTEXT.drawImage(
			VIDEO_ELEMENT,
			0,
			0,
			IMAGE_WIDTH,
			IMAGE_HEIGHT
		);

		// Check if the finger is positioned correctly
		checkFingerPlacement(SAMPLING_CANVAS, SAMPLING_CONTEXT);

		const value = averageBrightness(SAMPLING_CANVAS, SAMPLING_CONTEXT);
		
		const time = Date.now();

		SAMPLE_BUFFER.push({ value, time });
		if (SAMPLE_BUFFER.length > MAX_SAMPLES) {
			SAMPLE_BUFFER.shift();
		}

		//const dataStats = analyzeData(SAMPLE_BUFFER);
		//const bpm = calculateBpm(dataStats.crossings);

		

		// TODO: Store BPM values in array and display moving average
		
		if (DEBUG) {
			console.log("Graph Data:", SAMPLE_BUFFER);
		}
		const { smoothedData, peaks, bpm, dataStats } = processHeartRateData(SAMPLE_BUFFER);
		if (bpm) {
			setBpmDisplay(Math.round(bpm));
		}
		drawGraph(dataStats);
	};

	document.addEventListener("keydown", (event) => {
		if (event.key === 's') {
			console.log("Saving heart rate data...");
			saveDataAsJson();
		}
	});
	
	const applyStdDevFilter = (samples) => {

		//console.log("Applying filter, samples: ", samples); // Log the samples data to check its structure


		// Calculate the mean of the sample values
		const mean = samples.reduce((acc, sample) => acc + sample.value, 0) / samples.length;
	
		// Calculate the standard deviation of the sample values
		const stdDev = Math.sqrt(
			samples.reduce((acc, sample) => acc + Math.pow(sample.value - mean, 2), 0) / samples.length
		);
	
		// Define a threshold for outliers (e.g., 2 standard deviations)
		const threshold = 2;
	
		// Filter out the outliers (those beyond 2 standard deviations)
		const filtered = samples.filter((sample) => Math.abs(sample.value - mean) <= threshold * stdDev);
		
		// If all samples are outliers, return the original set (avoid returning empty array)
		return filtered.length > 0 ? filtered : samples;
	};
	
	const analyzeData = (samples) => {

		//console.log ("SAMPLES ARRAY: "+ samples)
		// Apply standard deviation filter to remove outliers
		const filteredSamples = applyStdDevFilter(samples);
	
		// If we have fewer than 2 samples after filtering, don't calculate further
		if (filteredSamples.length < 2) {
	
			return {
				average: 0,
				min: 0,
				max: 0,
				range: 0,
				crossings: []
			};
		}
	
		// Get the mean average value of the filtered samples
		const average =
			filteredSamples.map((sample) => sample.value).reduce((a, c) => a + c, 0) / filteredSamples.length;
	
		// Find the lowest and highest sample values in the filtered data
		let min = filteredSamples[0].value;
		let max = filteredSamples[0].value;
		filteredSamples.forEach((sample) => {
			if (sample.value > max) {
				max = sample.value;
			}
			if (sample.value < min) {
				min = sample.value;
			}
		});
	
		// The range of the change in values
		const range = max - min;
	
		// Get the crossing points (edges) in the filtered data
		const crossings = getAverageCrossings(filteredSamples, average);
	
		return {
			average,
			min,
			max,
			range,
			crossings,
		};
	};
	

	const getAverageCrossings = (samples, average) => {
		// Get each sample at points where the graph has crossed below the average level
		// These are visible as the rising edges that pass the midpoint of the graph
		const crossingsSamples = [];
		let previousSample = samples[0]; // Avoid if statement in loop

		samples.forEach(function (currentSample) {
			// Check if next sample has gone below average.
			if (
				currentSample.value < average &&
				previousSample.value > average
			) {
				crossingsSamples.push(currentSample);
			}

			previousSample = currentSample;
		});

		return crossingsSamples;
	};

	const calculateBpm = (samples) => {
		if (samples.length < 2) {
			return;
		}

		const averageInterval =
			(samples[samples.length - 1].time - samples[0].time) /
			(samples.length - 1);
		return 60000 / averageInterval;
	};



	const drawGraph = (dataStats) => {
		// Scaling of sample window to the graph width
		const xScaling = GRAPH_CANVAS.width / MAX_SAMPLES;

		// Set offset based on number of samples, so the graph runs from the right edge to the left
		const xOffset = (MAX_SAMPLES - SAMPLE_BUFFER.length) * xScaling;

		GRAPH_CONTEXT.lineWidth = GRAPH_WIDTH;
		GRAPH_CONTEXT.strokeStyle = GRAPH_COLOR;
		GRAPH_CONTEXT.lineCap = "round";
		GRAPH_CONTEXT.lineJoin = "round";

		GRAPH_CONTEXT.clearRect(0, 0, GRAPH_CANVAS.width, GRAPH_CANVAS.height);
		GRAPH_CONTEXT.beginPath();

		// Avoid drawing too close to the graph edges due to the line thickness getting cut off
		const maxHeight = GRAPH_CANVAS.height - GRAPH_CONTEXT.lineWidth * 2;
		let previousY = 0;
		SAMPLE_BUFFER.forEach((sample, i) => {
			const x = xScaling * i + xOffset;

			let y = GRAPH_CONTEXT.lineWidth;

			if (sample.value !== 0) {
				y =
					(maxHeight * (sample.value - dataStats.min)) /
						(dataStats.max - dataStats.min) +
					GRAPH_CONTEXT.lineWidth;
			}

			if (y != previousY) {
				GRAPH_CONTEXT.lineTo(x, y);
			}

			previousY = y;
		});

		GRAPH_CONTEXT.stroke();
	};

	return publicMethods;
})();
