from flask import Flask, request, jsonify
import numpy as np
from scipy.signal import find_peaks_cwt
from flask_cors import CORS 
from flask_cors import cross_origin


app = Flask(__name__)
CORS(app)

# Function to remove outliers using IQR
def remove_outliers_iqr(data, factor=1.5):
    data_values = [item['value'] for item in data]
    # Calculate the interquartile range (IQR)
    Q1 = np.percentile(data_values, 25)
    Q3 = np.percentile(data_values, 75)
    IQR = Q3 - Q1
    lower_bound = Q1 - factor * IQR
    upper_bound = Q3 + factor * IQR

    # Calculate the mean of the data
    mean_value = np.mean(data_values)

    # Replace outliers with the mean value
    cleaned_data = [
            {**item, 'value': mean_value if not (lower_bound <= item['value'] <= upper_bound) else item['value']}
            for item in data
        ]
    return cleaned_data
# Function to apply moving average smoothing
def moving_average(data, window_size):
    # Validate input
    if not isinstance(data, (list, np.ndarray)):
        raise ValueError("Data must be a list or numpy array.")
    if not isinstance(window_size, int) or window_size <= 0:
        raise ValueError("Window size must be a positive integer.")
    
    # Convert to numpy array if data is a list
    data = np.asarray(data)
    
    # Apply moving average with 'same' mode to keep the output size equal to input size
    return np.convolve(data, np.ones(window_size) / window_size, mode='same')

# Main function to process heart rate data
def getHeartBeat(data):
    
    cleaned_data = remove_outliers_iqr(data, factor=1.5)  # Clean the data
    # Extract just the 'value' field for smoothing
    cleaned_values = [item['value'] for item in cleaned_data]  # Ensure it's a flat list of numbers

    smoothed_data = moving_average(cleaned_values, window_size=3)  # Apply smoothing
    data_stats = {
        'min': np.min(smoothed_data),
        'max': np.max(smoothed_data)
    }
    # Perform peak detection using continuous wavelet transform
    widths = np.arange(1, 31)
    peaks = find_peaks_cwt(smoothed_data, widths)
    
    if len(peaks) < 2:
        print("Not enough peaks detected to calculate heart rate.")
        return 0, data_stats, smoothed_data
        
    
    # Calculate heart rate based on detected peaks
    frame_rate = 60  # Assuming 60 frames per second
    time_interval = 1 / frame_rate
    peak_times = peaks * time_interval  # Calculate peak times
    time_intervals = np.diff(peak_times)  # Calculate time intervals between peaks
    
    # Calculate the heart rate from time intervals
    heart_rates = 60 / time_intervals
    average_heart_rate = np.mean(heart_rates) if len(heart_rates) > 0 else 0
    
    
    return average_heart_rate, data_stats, smoothed_data

# API endpoint to process the data and return BPM
@app.route('/get_bpm', methods=['POST'])
def get_bpm():
    data = request.json.get('data')  # Get the data from the request body
    if data is None or len(data) == 0:
        return jsonify({"error": "No data provided"}), 400
    
    # Calculate the BPM using the provided data
    average_heart_rate, data_stats, smoothed_data = getHeartBeat(data)
    
    # Convert smoothed_data to a list before returning
    smoothed_data_list = smoothed_data.tolist() if isinstance(smoothed_data, np.ndarray) else smoothed_data
    
    # Return BPM along with data stats (min and max of smoothed data)
    return jsonify({
        'bpm': average_heart_rate,
        'dataStats': data_stats,
        'smoothedData': smoothed_data_list  # Include smoothed data for graphing
    })



if __name__ == '__main__':
    app.run(debug=True)
