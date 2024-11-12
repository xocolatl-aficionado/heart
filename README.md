#### How to run locally? ####

- Check out the dev branch. 
- ```chmod +x update_index.sh```
- ```chmod +x deploy.sh```
- ```chmod +x tunnel.sh```

- ```./deploy.sh```

This should do the following:
- Check if the backend is in fact running, and if so, start up SSH tunnelling to port 5000.
- Update index.html with the correct dynamic url that was generated in prior step, and push to remote branch
- Use this within front end code, statically, to call the backend.
- **TLDR**: ./deploy.sh does "everything" needed to put a local update on Netlify. ONLY RUN THIS ON THE DEV BRANCH. For example, if Adi works on this, he must work on adi/feature. 

#### Demo

See [demo](breathein.netlify.app) on the Chrome browser on your phone. Works for only Android presently. Needs to have the backend running via Ngrok to get heart beats! 

#### Features

- Touch the box on top of screen. The flashlight should turn on, and thereafter place the finger on the back camera and visualize your heartbeat. Breathe as the breathing circle indicates. 
- To debug values, touch the graph (either on phone or desktop) to download a JSON of values and run the code described in the [Testing](#testing) section. See sample JSON in the repo for format.
  
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

#### Testing

To test:
- Run the backend.py locally and expose it via ngrok.
- Update the ngrok url in the code
- Browse, using Chrome on Android, to the url corresponding to the branch you're looking at. e.g, for the ```faizan/feature``` branch, see [here](https://faizan-feature--breathein.netlify.app/). For the ```main`` branch, see [here](https://breathein.netlify.app/). 

- Code to test the backend server:
```
import requests
import json

# Define the URL of your deployed endpoint
url = "https://e4a0-159-2-29-32.ngrok-free.app/get_bpm"

# Sample input data (list of dictionaries with 'value' and 'time')
sample_data = {
    "data": [
        {"value": 0.65, "time": 1731115030342},
        {"value": 0.67, "time": 1731115030351},
        {"value": 0.70, "time": 1731115030360},
        {"value": 1.20, "time": 1731115030400},  # Outlier
        {"value": 0.72, "time": 1731115030500},
        {"value": 0.69, "time": 1731115030600},
        {"value": 0.68, "time": 1731115030700}
    ]
}

# Send a POST request with the sample data
try:
    response = requests.post(url, json=sample_data)
    
    # Check if the request was successful
    if response.status_code == 200:
        print("Response received successfully.")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Failed with status code: {response.status_code}")
        print("Response content:", response.text)

except Exception as e:
    print("Error while sending the request:", e)

```
- Code that debugs and graphs the downloaded JSON:
```
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import find_peaks

# Function to remove outliers using IQR (Interquartile Range) method
def remove_outliers_iqr(data, factor=1.5):
    Q1 = np.percentile(data, 25)
    Q3 = np.percentile(data, 75)
    IQR = Q3 - Q1
    lower_bound = Q1 - factor * IQR
    upper_bound = Q3 + factor * IQR

    outliers = 0
    cleaned_data = []
    for x in data:
        if lower_bound <= x <= upper_bound:
            cleaned_data.append(x)
        else:
            cleaned_data.append(np.nan)
            outliers += 1
    
    print(f"Number of outliers removed: {outliers}")
    return cleaned_data


# Function to apply moving average smoothing
def moving_average(data, window_size):
    return np.convolve(data, np.ones(window_size)/window_size, mode='valid')

import json
import numpy as np

# Read the JSON file
with open('/Users/adi/Downloads/heart_rate_data_2024-11-09_10-44-47.json', 'r') as file:
    data = json.load(file)

# Extract the 'value' field into a NumPy array
data = np.array([entry['value'] for entry in data])


# Step 1: Remove outliers using IQR method
cleaned_data = remove_outliers_iqr(data, factor=1.5)

# Step 2: Smooth the data with a moving average filter (optional)
smoothed_data = moving_average(cleaned_data, window_size=3)

# Step 3: Detect peaks (local maxima) in the smoothed data
peaks, properties = find_peaks(smoothed_data, width=2, distance=5, prominence=0.02)

# Plot the data and detected peaks
plt.plot(smoothed_data, label='Smoothed Data')
plt.scatter(peaks, smoothed_data[peaks], color='red', label='Detected Peaks')
plt.legend()
plt.xlabel('Time')
plt.ylabel('Signal Amplitude')
plt.title('Heartbeat Detection (With Outlier Removal)')
plt.show()

# Print detected peak indices
print(f"Detected peak indices: {peaks}")

```

#### Dependencies

- ```npm install ```
- Every commit to the ```adi/feature```, or ```faizan/feature``` or ```main``` branch will be auto deployed to the respective demo url (Netlify). 
 
- Need to run the backend separately (``` python3 backend.py```) on a local machine and expose it via ngrok. The Ngrok url is currently hardcoded into the codebase, but this will change each time ngrok is restarted. Please set acordingly as per [docs](https://ngrok.com/docs/getting-started/). 

#### Credits: This [repo](https://github.com/richrd/heart-rate-monitor), provided us with a way to begin w/o the hassle of a mobile app setup and play with sensor readings immediately. I'm extremely grateful for this. 
We have thereafter enhanced the app with (more)stable heart rates, and breathing routines, with the intent to turn it into a panic-diffusing human computer interative (HCI) application. 

