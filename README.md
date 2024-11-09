
#### Demo
See [demo](breathein.netlify.app) on the Chrome browser on your phone. 

#### Architecture
```
+---------------------+
|    User Input       |
|  (Camera Video)     |
+---------------------+
          |
          v
+---------------------+
| Preprocessing Layer |
|  - Frame Extraction |
|  - Brightness Calc  |
+---------------------+
          |
          v
+-----------------------+
| Signal Processing     |
|  - Peak Detection     |
|  - Outlier Filtering  |
|  - Smoothing (Avg)    |
+-----------------------+
          |
          v
+-----------------------+
| BPM Calculation       |
|  - Measure Intervals  |
|  - Calculate BPM      |
+-----------------------+
          |
          v
+-----------------------+
|    Output Layer       |
|  - Display BPM        |
|  - Panic Level Guide  |
+-----------------------+
          |
          v
+---------------------+
| UI/UX Interface     |
|  - Show Heart Rate  |
|  - Breathing Guide  |
+---------------------+
```

#### Getting the heart rates right
- Heart Rate Measurement: The app detects heart rate by analyzing video frames and measuring finger brightness.
- Peak Detection: SciPy is used to find peaks in the brightness data to calculate heart rate.
- Outlier Handling: Outliers in data are filtered using a method that removes extreme values.
- Data Smoothing: A moving average is applied to smooth out noise in the signal.
- BPM Calculation: The time between detected peaks is used to calculate the beats per minute (BPM).
- Real-Time Feedback: The app provides real-time guidance based on the heart rate and panic levels.

#### Dependencies

- ```npm install ```
- Every commit to the ```adi/feature``` branch will be auto deployed to the demo url (Netlify).
 
- Need to run the backend separately (``` python3 backend.py```) on a local machine and expose it via ngrok. The Ngrok url is currently hardcoded into the codebase, but this will change each time ngrok is restarted. Please set acordingly as per [docs](https://ngrok.com/docs/getting-started/). 

#### Credits: This [repo](https://github.com/richrd/heart-rate-monitor), provided us with a way to begin w/o the hassle of a mobile app setup and play with sensor readings immediately. I'm extremely grateful for this. 
We have thereafter enhanced the app with (more)stable heart rates, and breathing routines, with the intent to turn it into a panic-diffusing human computer interative (HCI) application. 

