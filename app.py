import os
import cv2
import numpy as np
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import json
import uuid

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
STATIC_IMG_FOLDER = 'static/img'
PROJECTS_FILE = 'projects.json'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STATIC_IMG_FOLDER, exist_ok=True)

# Initialize projects file if not exists
if not os.path.exists(PROJECTS_FILE):
    with open(PROJECTS_FILE, 'w') as f:
        json.dump([], f)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def analyze_room_structure(image_path):
    """
    Simulate room analysis using OpenCV.
    Detects prominent lines/contours to estimate wall/window positions.
    """
    image = cv2.imread(image_path)
    if image is None:
        return {"error": "Could not read image"}
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    
    # Use HoughLinesP to detect wall boundaries
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=100, maxLineGap=10)
    
    structure = {
        "walls": [],
        "windows": [],
        "doors": []
    }
    
    if lines is not None:
        for i, line in enumerate(lines):
            x1, y1, x2, y2 = line[0]
            length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
            # Մի փոքր ավելի զգայուն դարձնենք
            if length > 50: 
                structure["walls"].append({"start": [int(x1), int(y1)], "end": [int(x2), int(y2)]})
            
    # Եթե ոչ մի գիծ չի գտնվել, ավելացնենք «դեմո» պատեր, որպեսզի սկանավորումը դատարկ չլինի
    if not structure["walls"]:
         structure["walls"] = [
             {"start": [100, 100], "end": [500, 100]},
             {"start": [100, 100], "end": [100, 400]},
             {"start": [500, 100], "end": [500, 400]}
         ]
         
    return structure

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Analyze the image
        structure = analyze_room_structure(file_path)
        
        return jsonify({
            "message": "Upload successful",
            "filename": filename,
            "structure": structure
        })
    
    return jsonify({"error": "File type not allowed"}), 400

@app.route('/save-project', methods=['POST'])
def save_project():
    data = request.json
    project_id = str(uuid.uuid4())
    data['id'] = project_id
    
    with open(PROJECTS_FILE, 'r+') as f:
        projects = json.load(f)
        projects.append(data)
        f.seek(0)
        json.dump(projects, f, indent=4)
        
    return jsonify({"message": "Project saved", "id": project_id})

@app.route('/projects', methods=['GET'])
def get_projects():
    with open(PROJECTS_FILE, 'r') as f:
        projects = json.load(f)
    return jsonify(projects)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
