from flask import Flask, request, jsonify
from flask_mysqldb import MySQL
from flask_bcrypt import Bcrypt
import MySQLdb.cursors
import jwt
from datetime import datetime, timedelta
import random
from flask_cors import CORS
from functools import wraps
import os
from werkzeug.utils import secure_filename
from flask import send_from_directory
import requests
from flask_socketio import SocketIO
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER')
bcrypt = Bcrypt(app)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_flat = data['flat_number']
        except:
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user_flat, *args, **kwargs)
    return decorated

#Database Configuration
app.config['MYSQL_HOST'] = os.getenv('DB_HOST')
app.config['MYSQL_USER'] = os.getenv('DB_USER')
app.config['MYSQL_PASSWORD'] = os.getenv('DB_PASSWORD')
app.config['MYSQL_DB'] = os.getenv('DB_NAME')
app.config['MYSQL_CURSORCLASS'] = os.getenv('DB_CURSORCLASS')

mysql = MySQL(app)

#Checking app route
@app.route('/')
def home():
    return "ApnaGate API is running!"

#Register API
@app.route('/api/resident/register', methods=['POST'])
def register_resident():
    data = request.get_json()
    name = data['name']
    phone_number = data['phone_number']
    flat_number = data['flat_number']
    password = data['password']
    vehicles = data.get('vehicles', [])

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    cursor = mysql.connection.cursor()

    try:

        cursor.execute(
            'INSERT INTO residents (name, phone_number, flat_number, password) VALUES (%s, %s, %s, %s)',
            (name, phone_number, flat_number, hashed_password)
        )
        resident_id = cursor.lastrowid

        if vehicles:
            for vehicle_num in vehicles:
                cursor.execute(
                    'INSERT INTO vehicles (resident_id, vehicle_number) VALUES (%s, %s)',
                    (resident_id, vehicle_num)
                )

        mysql.connection.commit()
        cursor.close()

        return jsonify({'message': f'Resident {name} in flat {flat_number} registered successfully!'}), 201

    except MySQLdb.IntegrityError as e:
        cursor.close()
        return jsonify({'error': 'Flat number or phone number already exists.'}), 409
    except Exception as e:
        cursor.close()
        return jsonify({'error': str(e)}), 500

#Login API
@app.route('/api/resident/login', methods=['POST'])
def login_resident():
    data = request.get_json()
    flat_number = data['flat_number']
    password = data['password']

    cursor = mysql.connection.cursor()

    cursor.execute('SELECT * FROM residents WHERE flat_number = %s', [flat_number])
    resident = cursor.fetchone()
    cursor.close()

    if resident and bcrypt.check_password_hash(resident['password'], password):
        token = jwt.encode({
            'resident_id': resident['id'],
            'flat_number': resident['flat_number'],
            'exp': datetime.utcnow() + timedelta(days=30)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            'message': 'Login successful!',
            'token': token,
            'name': resident['name']
        })

    else:
        return jsonify({'error': 'Invalid flat number or password'}), 401

#Guard App APIS
#Check Vehicle API
@app.route('/api/gate/check-vehicle', methods=['POST'])
def check_vehicle():
    data = request.get_json()
    vehicle_number = data.get('vehicle_number')

    if not vehicle_number:
        return jsonify({'error': 'Vehicle number is required'}), 400

    cursor = mysql.connection.cursor()

    query = """
        SELECT v.vehicle_number, r.name, r.flat_number
        FROM vehicles v
        JOIN residents r ON v.resident_id = r.id
        WHERE v.vehicle_number = %s
    """
    cursor.execute(query, [vehicle_number])
    vehicle_data = cursor.fetchone()
    cursor.close()

    if vehicle_data:
        return jsonify({
            'status': 'Resident',
            'details': vehicle_data
        })
    else:
        return jsonify({
            'status': 'Visitor'
        })

#App Notifications
#Update FCM Token
@app.route('/api/resident/update-fcm-token', methods=['POST'])
@token_required
def update_fcm_token(current_user_flat):
    data = request.get_json()
    fcm_token = data.get('fcm_token')

    if not fcm_token:
        return jsonify({'error': 'FCM token is missing.'}), 400

    cursor = mysql.connection.cursor()
    cursor.execute(
        "UPDATE residents SET fcm_token = %s WHERE flat_number = %s",
        (fcm_token, current_user_flat)
    )
    mysql.connection.commit()
    cursor.close()
    return jsonify({'message': 'FCM token updated successfully.'})

#Generate PIN API
@app.route('/api/gate/generate-pin', methods=['POST'])
def generate_pin():
    data = request.get_json()
    visitor_phone = data.get('visitor_phone_number')
    flat_number = data.get('resident_flat_number')

    if not visitor_phone or not flat_number:
        return jsonify({'error': 'Visitor phone and flat number are required'}), 400

    pin_code = random.randint(1000, 9999)

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT id, fcm_token FROM residents WHERE flat_number = %s", [flat_number])
        resident = cursor.fetchone()
        if not resident:
            cursor.close()
            return jsonify({'error': 'This flat number does not exist.'}), 404

        cursor.execute(
            "INSERT INTO visitor_logs (visitor_phone_number, resident_flat_number, pin_code, status) VALUES (%s, %s, %s, 'PENDING')",
            (visitor_phone, flat_number, pin_code)
        )
        mysql.connection.commit()

        resident_expo_token = resident.get('fcm_token')
        if resident_expo_token:
            try:
                headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                }
                data = {
                    'to': resident_expo_token,
                    'title': 'Visitor at the Gate!',
                    'body': f'A visitor is at the gate. The PIN is {pin_code}.',
                    'sound': 'default'
                }
                requests.post('https://exp.host/--/api/v2/push/send', headers=headers, json=data)
                print(f"Successfully sent notification request to Expo for flat {flat_number}")
            except Exception as e:
                print(f"Error sending notification via Expo: {e}")
        new_notification_data = {
            'visitor_phone_number': visitor_phone,
            'pin_code': pin_code,
            'flat_number': flat_number,
        }

        socketio.emit('new_visitor_alert', new_notification_data)
        print(f"Emitted 'new_visitor_alert' for flat {flat_number}")
        cursor.close()

        return jsonify({
            'message': f'PIN generated and notification sent to the resident of {flat_number}.'
        }), 201

    except Exception as e:
        cursor.close()
        return jsonify({'error': str(e)}), 500

#Verify PIN API
@app.route('/api/gate/verify-pin', methods=['POST'])
def verify_pin():
    data = request.get_json()
    pin_code = data.get('pin_code')
    flat_number = data.get('resident_flat_number')

    if not pin_code or not flat_number:
        return jsonify({'error': 'PIN code and flat number are required'}), 400

    cursor = mysql.connection.cursor()

    try:
        query = """
            SELECT id FROM visitor_logs 
            WHERE pin_code = %s AND resident_flat_number = %s AND status = 'PENDING'
        """
        cursor.execute(query, (pin_code, flat_number))
        log_entry = cursor.fetchone()

        if log_entry:
            log_id = log_entry['id']
            cursor.execute("UPDATE visitor_logs SET status = 'APPROVED' WHERE id = %s", [log_id])
            mysql.connection.commit()
            cursor.close()

            return jsonify({'message': 'ACCESS GRANTED'})

        else:
            cursor.close()
            return jsonify({'error': 'Invalid or Expired PIN. Access DENIED.'}), 401

    except Exception as e:
        cursor.close()
        return jsonify({'error': str(e)}), 500

#Notification Bell in APP
@app.route('/api/resident/notifications', methods=['GET'])
@token_required
def get_notifications(current_user_flat):
    cursor = mysql.connection.cursor()
    cursor.execute(
        "SELECT id, visitor_phone_number, pin_code, entry_time, is_read FROM visitor_logs WHERE resident_flat_number = %s AND status = 'PENDING' ORDER BY entry_time DESC",
        [current_user_flat]
    )
    notifications = cursor.fetchall()
    cursor.close()
    return jsonify(notifications)

@app.route('/api/resident/notifications/mark-as-read', methods=['POST'])
@token_required
def mark_notifications_as_read(current_user_flat):
    cursor = mysql.connection.cursor()
    cursor.execute(
        "UPDATE visitor_logs SET is_read = 1 WHERE resident_flat_number = %s AND status = 'PENDING'",
        [current_user_flat]
    )
    mysql.connection.commit()
    cursor.close()
    return jsonify({'message': 'All notifications marked as read.'})

#Change Password API
@app.route('/api/resident/change-password', methods=['POST'])
@token_required
def change_password(current_user_flat):
    data = request.get_json()
    old_password = data['old_password']
    new_password = data['new_password']

    cursor = mysql.connection.cursor()

    cursor.execute("SELECT password, id FROM residents WHERE flat_number = %s", [current_user_flat])
    user = cursor.fetchone()
    current_hashed_password = user['password']
    resident_id = user['id']

    if bcrypt.check_password_hash(current_hashed_password, old_password):
        new_hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        cursor.execute(
            "UPDATE residents SET password = %s WHERE id = %s",
            (new_hashed_password, resident_id)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({'message': 'Password updated successfully!'})
    else:
        cursor.close()
        return jsonify({'error': 'Incorrect old password.'}), 401

#Vehicle Update APIs
#Get vehicle API
@app.route('/api/resident/vehicles', methods=['GET'])
@token_required
def get_vehicles(current_user_flat):
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT id FROM residents WHERE flat_number = %s", [current_user_flat])
    resident_id = cursor.fetchone()['id']

    cursor.execute("SELECT id, vehicle_number FROM vehicles WHERE resident_id = %s", [resident_id])
    vehicles = cursor.fetchall()
    cursor.close()
    return jsonify(vehicles)


#Add Vehicle API
@app.route('/api/resident/vehicles/add', methods=['POST'])
@token_required
def add_vehicle(current_user_flat):
    data = request.get_json()
    new_vehicle_number = data['vehicle_number'].upper()

    if not new_vehicle_number:
        return jsonify({'error': 'Vehicle number cannot be empty.'}), 400

    cursor = mysql.connection.cursor()
    cursor.execute("SELECT id FROM residents WHERE flat_number = %s", [current_user_flat])
    resident_id = cursor.fetchone()['id']

    cursor.execute("SELECT id FROM vehicles WHERE vehicle_number = %s", [new_vehicle_number])
    if cursor.fetchone():
        cursor.close()
        return jsonify({'error': 'This vehicle number is already registered.'}), 409

    cursor.execute(
        "INSERT INTO vehicles (resident_id, vehicle_number) VALUES (%s, %s)",
        (resident_id, new_vehicle_number)
    )
    mysql.connection.commit()
    cursor.close()
    return jsonify({'message': 'Vehicle added successfully!'}), 201


#Delete Vehicle API
@app.route('/api/resident/vehicles/delete', methods=['POST'])
@token_required
def delete_vehicle(current_user_flat):
    data = request.get_json()
    vehicle_id_to_delete = data['vehicle_id']

    cursor = mysql.connection.cursor()
    cursor.execute("SELECT id FROM residents WHERE flat_number = %s", [current_user_flat])
    resident_id = cursor.fetchone()['id']

    cursor.execute(
        "DELETE FROM vehicles WHERE id = %s AND resident_id = %s",
        (vehicle_id_to_delete, resident_id)
    )
    mysql.connection.commit()

    if cursor.rowcount > 0:
        message = 'Vehicle deleted successfully!'
    else:
        message = 'Error: Vehicle not found or you do not have permission to delete it.'

    cursor.close()
    return jsonify({'message': message})

#Visitor History API
@app.route('/api/resident/history', methods=['GET'])
@token_required
def get_history(current_user_flat):
    cursor = mysql.connection.cursor()
    cursor.execute(
        "SELECT visitor_phone_number, status, entry_time FROM visitor_logs WHERE resident_flat_number = %s AND status != 'PENDING' ORDER BY entry_time DESC",
        [current_user_flat]
    )
    history = cursor.fetchall()
    cursor.close()
    return jsonify(history)

#Profile APIS
'''@app.route('/api/resident/me', methods=['GET'])
@token_required
def get_my_profile(current_user_flat):
    cursor = mysql.connection.cursor()
    cursor.execute(
        "SELECT name, flat_number, phone_number, profile_image_url FROM residents WHERE flat_number = %s",
        [current_user_flat]
    )
    profile_data = cursor.fetchone()
    cursor.close()

    if profile_data:
        return jsonify(profile_data)
    else:
        return jsonify({'error': 'Profile not found.'}), 404
'''

@app.route('/api/resident/me', methods=['GET'])
@token_required
def get_my_profile(current_user_flat):
    try:
        cursor = mysql.connection.cursor()
        sql_query = "SELECT name, flat_number, phone_number, profile_image_url FROM residents WHERE flat_number = %s"
        cursor.execute(sql_query, [current_user_flat])
        profile_data = cursor.fetchone()

        cursor.close()

        if profile_data:
            return jsonify(profile_data)
        else:
            return jsonify({'error': 'Profile not found.'}), 404

    except Exception as e:
        return jsonify({'error': 'An internal server error occurred.'}), 500

#Profile Picture Add/Remove APIS

@app.route('/uploads/profile_pics/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/resident/picture', methods=['POST'])
@token_required
def upload_profile_picture(current_user_flat):
    if 'profile_pic' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['profile_pic']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filename = secure_filename(file.filename)
    unique_filename = current_user_flat + "_" + str(int(datetime.now().timestamp())) + "_" + filename
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(file_path)

    image_url = f"/uploads/profile_pics/{unique_filename}"
    cursor = mysql.connection.cursor()
    cursor.execute("UPDATE residents SET profile_image_url = %s WHERE flat_number = %s", (image_url, current_user_flat))
    mysql.connection.commit()
    cursor.close()

    return jsonify({'message': 'Profile picture updated!', 'image_url': image_url})


@app.route('/api/resident/picture', methods=['DELETE'])
@token_required
def delete_profile_picture(current_user_flat):
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT profile_image_url FROM residents WHERE flat_number = %s", [current_user_flat])
    result = cursor.fetchone()

    if result and result.get('profile_image_url'):
        file_to_delete_path = os.path.join(result['profile_image_url'].lstrip('/'))
        if os.path.exists(file_to_delete_path):
            os.remove(file_to_delete_path)

    cursor.execute("UPDATE residents SET profile_image_url = NULL WHERE flat_number = %s", [current_user_flat])
    mysql.connection.commit()
    cursor.close()
    return jsonify({'message': 'Profile picture removed.'})

#Socket Connection for realtime app updates
@socketio.on('connect')
def handle_connect():
    print('Client connected!')


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected!')

#Emergency SOS feature
@socketio.on('resident_sos')
def handle_sos_event(data):
    flat_number = data.get('flat_number', 'Unknown')
    phone_number = data.get('phone_number', 'Unknown')
    print(f"!!! EMERGENCY SOS RECEIVED from flat: {flat_number} (Phone: {phone_number}) !!!")
    socketio.emit('sos_alert', {'flat_number': flat_number, 'phone_number': phone_number})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)