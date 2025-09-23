from flask import Flask, render_template, request, redirect, url_for, flash, session
import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import os
from werkzeug.utils import secure_filename
from datetime import date
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Secure random secret key for sessions; store safely in prod
UPLOAD_FOLDER = 'static/uploads/profile_pics'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

socketio = SocketIO(app)
online_users = {} # maps user_id to sid

def get_db_connection():
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="@uttej123*",  
            database="blood_donation"  # Use your actual DB name
        )
    except Error as e:
        print("DB connection error:", e)
        return None

@app.context_processor
def inject_session():
    unread_count = 0
    if 'user_id' in session:
        conn = get_db_connection()
        if conn:
            try:
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM messages WHERE receiver_id = %s AND is_read = 0", (session['user_id'],))
                result = cur.fetchone()
                if result:
                    unread_count = result[0]
                cur.close()
            except Error as e:
                print("Error fetching unread count:", e)
            finally:
                if conn.is_connected():
                    conn.close()
    return dict(session=session, unread_count=unread_count)

def calculate_age(born):
    if not born:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
app.jinja_env.globals.update(calculate_age=calculate_age)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/get-involved', methods=['GET', 'POST'])
def get_involved_page():
    if request.method == 'POST':
        form_type = request.form.get('form_type')
        conn = get_db_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return render_template('get-involved.html')

        cur = None  # Initialize cursor to None for the finally block
        try:

            if form_type == 'donor_update':
                if 'user_id' not in session:
                    return redirect(url_for('home'))

                user_id = session['user_id']
                name = request.form.get('name')
                dob = request.form.get('dob')
                gender = request.form.get('gender')
                contact = request.form.get('contact')
                pincode = request.form.get('pincode')
                blood_group = request.form.get('bloodgroup')

                cur = conn.cursor()
                cur.execute(
                    "UPDATE donor SET name=%s, dob=%s, gender=%s, contact=%s, pincode=%s, blood_group=%s WHERE profile_id=%s",
                    (name, dob, gender, contact, pincode, blood_group, user_id)
                )
                conn.commit()
                flash("Your donor profile has been updated successfully!", "success")
                return redirect(url_for('my_profile_page'))

            if form_type == 'signup':
                username = request.form.get('signup-name', '').strip()
                email = request.form.get('signup-email', '').strip().lower()
                password = request.form.get('signup-password', '')
                confirm = request.form.get('signup-confirm-password', '')
                dob = request.form.get('signup-dob')
                gender = request.form.get('signup-gender')
                contact = request.form.get('signup-contact')
                pincode = request.form.get('signup-pincode', '').strip()
                blood_group = request.form.get('signup-bloodgroup')

                if not all([username, email, password, dob, gender, contact, pincode, blood_group]):
                    flash("Please fill all signup fields.", "warning")
                    return render_template('get-involved.html')
                if password != confirm:
                    flash("Passwords do not match.", "warning")
                    return render_template('get-involved.html')

                cur = conn.cursor()
                cur.execute("SELECT user_id FROM profile WHERE username=%s OR email=%s", (username, email))
                if cur.fetchone():
                    flash("Username or email already exists. Please choose different ones.", "warning")
                    cur.close()
                    return render_template('get-involved.html')

                hashed = generate_password_hash(password)

                cur.execute("INSERT INTO profile (username, email, password) VALUES (%s, %s, %s)", (username, email, hashed))
                profile_id = cur.lastrowid

                cur.execute(
                    "INSERT INTO donor (profile_id, name, dob, gender, contact, pincode, blood_group) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (profile_id, username, dob, gender, contact, pincode, blood_group)
                )

                conn.commit()
                flash("Signup successful! Please log in.", "success")
                return redirect(url_for('get_involved_page'))

            elif form_type == 'login':
                identifier = request.form.get('login-email', '').strip().lower()
                password = request.form.get('login-password', '')
                if not identifier or not password:
                    flash("Please enter your credentials.", "warning")
                    return render_template('get-involved.html')

                cur = conn.cursor(dictionary=True)
                cur.execute("""
                    SELECT p.user_id, p.username, p.password, d.profile_picture_url
                    FROM profile p LEFT JOIN donor d ON p.user_id = d.profile_id
                    WHERE p.username=%s OR p.email=%s
                """, (identifier, identifier))
                user = cur.fetchone()

                if user and check_password_hash(user['password'], password):
                    session['user_id'] = user['user_id']
                    session['username'] = user['username']
                    session['profile_pic_url'] = user.get('profile_picture_url')
                    flash(f"Welcome back, {user['username']}!", "success")
                    return redirect(url_for('my_profile_page'))
                else:
                    flash("Invalid credentials. Please try again.", "danger")
                    return render_template('get-involved.html')

        except Error as e:
            if conn:
                conn.rollback()  # Roll back the transaction on any DB error
            print(f"DB error on {form_type}:", e)
            flash("A database error occurred.", "danger")
        finally:
            if cur:
                cur.close()
            if conn and conn.is_connected():
                conn.close()

    # GET request logic
    donor_data = None
    if 'user_id' in session:
        conn = get_db_connection()
        if conn:
            try:
                cur = conn.cursor(dictionary=True)
                cur.execute("SELECT * FROM donor WHERE profile_id = %s", (session['user_id'],))
                donor_data = cur.fetchone()
            except Error as e:
                print("Error fetching donor data for form:", e)
            finally:
                if conn and conn.is_connected():
                    cur.close()
                    conn.close()

    return render_template('get-involved.html', donor_data=donor_data)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/my-profile', methods=['GET', 'POST'])
def my_profile_page():
    if 'user_id' not in session:
        flash("Please log in to view this page.", "warning")
        return redirect(url_for('get_involved_page'))

    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return render_template('my-profile.html', user=None)

    if request.method == 'POST':
        fullname = request.form.get('fullName')
        email = request.form.get('email')
        phone = request.form.get('phone')
        pincode = request.form.get('pincode')
        dob = request.form.get('dob')
        blood_group = request.form.get('bloodgroup')
        profile_pic = request.files.get('profile-picture')

        try:
            cur = conn.cursor()
            
            pfp_url = None
            if profile_pic and allowed_file(profile_pic.filename):
                filename = secure_filename(f"user_{user_id}_{profile_pic.filename}")
                # Ensure the upload directory exists
                os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                profile_pic.save(filepath)
                pfp_url = f"uploads/profile_pics/{filename}"

                # Update profile picture URL in the database
                cur.execute("UPDATE donor SET profile_picture_url=%s WHERE profile_id=%s", (pfp_url, user_id))
                session['profile_pic_url'] = pfp_url # Update session immediately

            cur.execute("UPDATE profile SET username=%s, email=%s WHERE user_id=%s", (fullname, email, user_id))
            cur.execute(
                "UPDATE donor SET name=%s, contact=%s, pincode=%s, dob=%s, blood_group=%s WHERE profile_id=%s",
                (fullname, phone, pincode, dob, blood_group, user_id)
            )
            session['username'] = fullname
            
            conn.commit()
            cur.close()
            flash("Profile updated successfully!", "success")
        except Error as e:
            print("DB error on profile update:", e)
            flash("An error occurred while updating your profile.", "danger")
        finally:
            if conn.is_connected():
                conn.close()
        return redirect(url_for('my_profile_page'))

    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT p.username, p.email, d.name, d.dob, d.gender, d.blood_group, d.pincode, d.contact, d.profile_picture_url
            FROM profile p LEFT JOIN donor d ON p.user_id = d.profile_id WHERE p.user_id = %s
        """, (user_id,))
        user_data = cur.fetchone()

        # Fetch donation history
        cur.execute("""
            SELECT dn.donation_date, dn.location, dn.units
            FROM donations dn
            JOIN donor d ON dn.donor_id = d.donor_id
            WHERE d.profile_id = %s
            ORDER BY dn.donation_date DESC
        """, (user_id,))
        donation_history = cur.fetchall()
        cur.close()
    except Error as e:
        print("DB error fetching profile:", e)
        flash("Could not load your profile.", "danger")
        user_data = None
        donation_history = []
    finally:
        if conn.is_connected():
            conn.close()

    return render_template('my-profile.html', user=user_data, donation_history=donation_history)


@app.route('/logout')
def logout():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for('home'))

@app.route('/search-donors', methods=['GET', 'POST'])
def search_donors_page():
    donors = []
    if request.method == 'POST':
        blood_group = request.form.get('bloodgroup')
        pincode = request.form.get('pincode', '').strip()
        conn = get_db_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return render_template('search-donors.html', donors=[])
        
        try:
            cur = conn.cursor(dictionary=True)
            # Join with profile table to get email for the request button
            query = """
                SELECT d.name, d.dob, d.gender, d.blood_group, d.pincode, d.contact, p.email, p.user_id
                FROM donor d
                JOIN profile p ON d.profile_id = p.user_id
                WHERE d.blood_group = %s AND d.pincode = %s
            """
            cur.execute(query, (blood_group, pincode))
            donors = cur.fetchall()
            cur.close()
            if not donors:
                flash(f"No donors found for blood group {blood_group} in PIN code {pincode}.", "info")
        except Error as e:
            print("DB error on donor search:", e)
            flash("An error occurred during the search.", "danger")
        finally:
            if conn.is_connected():
                conn.close()

    return render_template('search-donors.html', donors=donors)

@app.route('/leaderboard')
def leaderboard_page():
    leaders = []
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return render_template('leaderboard.html', leaders=[])
    
    try:
        cur = conn.cursor(dictionary=True)
        # Real query to calculate top donors from the donations table
        query = """
            SELECT d.name, d.pincode, COUNT(dn.donation_id) as donations
            FROM donations dn
            JOIN donor d ON dn.donor_id = d.donor_id
            GROUP BY d.donor_id, d.name, d.pincode
            ORDER BY donations DESC
            LIMIT 10
        """
        cur.execute(query)
        leaders = cur.fetchall()
        
        # Add mock donation counts and prizes
        for i, leader in enumerate(leaders):
            leader['prize'] = f"${max(0, 300 - i*100)}" if i < 3 else "---"
    except Error as e:
        print("DB error on leaderboard fetch:", e)
        flash("Could not load the leaderboard.", "danger")
    finally:
        if conn and conn.is_connected():
            cur.close()
            conn.close()

    return render_template('leaderboard.html', leaders=leaders)

@app.route('/blood-request', methods=['GET', 'POST'])
def blood_request_page():
    if request.method == 'POST':
        flash("Your blood request has been submitted.", "success")
        return redirect(url_for('home'))
    return render_template('blood-request.html')

@app.route('/blood-drives')
def blood_drives_page():
    drives = []
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return render_template('blood-drives.html', drives=[])
    
    try:
        cur = conn.cursor(dictionary=True)
        # Fetch drives that are in the future
        query = "SELECT * FROM blood_drives WHERE drive_date >= CURDATE() ORDER BY drive_date ASC"
        cur.execute(query)
        drives = cur.fetchall()
    except Error as e:
        print("DB error on blood drives fetch:", e)
        flash("Could not load blood drives.", "danger")
    finally:
        if conn and conn.is_connected():
            cur.close()
            conn.close()

    return render_template('blood-drives.html', drives=drives)

# --- Placeholder Routes to prevent 404 errors ---

@app.route('/faqs')
def faqs_page():
    return render_template('faqs.html')

@app.route('/admin-login', methods=['GET', 'POST'])
def admin_login_page():
    if request.method == 'POST':
        flash("Admin login functionality is not yet implemented.", "info")
    return render_template('admin-login.html')

@app.route('/emergency-request', methods=['GET', 'POST'])
def emergency_request_page():
    if request.method == 'POST':
        flash("Emergency request has been broadcast.", "success")
        return redirect(url_for('home'))
    return render_template('emergency-request.html')

@app.route('/request-donor/<int:donor_id>', methods=['GET', 'POST'])
def request_donor_page(donor_id):
    if 'user_id' not in session:
        flash("You must be logged in to make a request.", "warning")
        return redirect(url_for('get_involved_page'))

    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for('search_donors_page'))

    donor = None
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT p.user_id, d.name, d.blood_group FROM donor d JOIN profile p ON d.profile_id = p.user_id WHERE p.user_id = %s", (donor_id,))
        donor = cur.fetchone()
    except Error as e:
        print("DB error fetching donor for request page:", e)
    finally:
        if conn and conn.is_connected():
            cur.close()
            conn.close()

    if not donor:
        flash("Donor not found.", "danger")
        return redirect(url_for('search_donors_page'))

    if request.method == 'POST':
        requester_id = session['user_id']
        subject = f"Blood Request for {request.form.get('blood_group')}"
        body = f"""
        Patient Name: {request.form.get('patient_name')}
        Required Units: {request.form.get('units')}
        Hospital: {request.form.get('hospital')}
        Contact: {request.form.get('contact_phone')}
        Reason: {request.form.get('reason')}
        """
        conn = get_db_connection() # Re-open connection for POST
        if not conn:
            flash("Database connection failed.", "danger")
            return render_template('request-donor.html', donor=donor)
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO messages (sender_id, receiver_id, subject, body) VALUES (%s, %s, %s, %s)",
                (requester_id, donor_id, subject, body)
            )
            conn.commit()
            cur.close()

            # Emit real-time event to the receiver if they are online
            receiver_sid = online_users.get(donor_id)
            if receiver_sid:
                emit('new_message', {
                    'sender_id': requester_id,
                    'sender_username': session.get('username'),
                    'body': body,
                    'created_at': date.today().strftime('%b %d, %I:%M %p') # Simplified time for real-time
                }, to=receiver_sid)

            flash("Your request has been sent to the donor!", "success")
            return redirect(url_for('conversation_page', other_user_id=donor_id))
        except Error as e:
            print("DB error sending message:", e)
            flash("Could not send your request.", "danger")
        finally:
            if conn and conn.is_connected():
                conn.close()

    return render_template('request-donor.html', donor=donor)

@app.route('/inbox')
def inbox_page():
    if 'user_id' not in session:
        flash("Please log in to view your inbox.", "warning")
        return redirect(url_for('get_involved_page'))
    
    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return render_template('inbox.html', conversations=[])

    conversations = []
    try:
        # Corrected query to get the last message from each conversation partner, including profile picture
        query = """
            SELECT p.user_id, p.username, d.profile_picture_url, m.body, m.created_at, m.is_read,
                   IF(m.sender_id = %s, 0, 1) as is_other_sender
            FROM messages m
            JOIN profile p ON p.user_id = IF(m.sender_id = %s, m.receiver_id, m.sender_id)
            LEFT JOIN donor d ON p.user_id = d.profile_id
            WHERE m.message_id IN (
                SELECT MAX(message_id) FROM messages WHERE sender_id = %s OR receiver_id = %s
                GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
            ) ORDER BY m.created_at DESC
        """
        cur = conn.cursor(dictionary=True)
        cur.execute(query, (user_id, user_id, user_id, user_id))
        conversations = cur.fetchall()
    except Error as e:
        print("DB error on inbox fetch:", e)
        flash("Could not load your inbox.", "danger")
    finally:
        if conn and conn.is_connected():
            cur.close()
            conn.close()
    return render_template('inbox.html', conversations=conversations)

@app.route('/conversation/<int:other_user_id>', methods=['GET', 'POST'])
def conversation_page(other_user_id):
    if 'user_id' not in session:
        return redirect(url_for('get_involved_page'))

    user_id = session['user_id']

    if request.method == 'POST':
        body = request.form.get('body')
        if body:
            conn = get_db_connection()
            if conn:
                try:
                    cur = conn.cursor()
                    cur.execute("INSERT INTO messages (sender_id, receiver_id, subject, body) VALUES (%s, %s, %s, %s)", (user_id, other_user_id, 'Re: Blood Request', body))
                    conn.commit()

                    # Emit real-time event to the receiver if they are online
                    receiver_sid = online_users.get(other_user_id)
                    if receiver_sid:
                        emit('new_message', {
                            'sender_id': user_id,
                            'sender_username': session.get('username'),
                            'body': body,
                            'created_at': date.today().strftime('%b %d, %I:%M %p') # Simplified time
                        }, to=receiver_sid)
                except Error as e:
                    print("DB error sending reply:", e)
                    flash("Could not send your reply.", "danger")
                finally:
                    if conn and conn.is_connected():
                        cur.close()
                        conn.close()
        return redirect(url_for('conversation_page', other_user_id=other_user_id))

    # GET request logic
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed.", "danger")
        return redirect(url_for('inbox_page'))
        
    messages = []
    other_user = None
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("UPDATE messages SET is_read = 1 WHERE receiver_id = %s AND sender_id = %s", (user_id, other_user_id))
        conn.commit()
        cur.execute("SELECT m.*, p.username as sender_username FROM messages m JOIN profile p ON m.sender_id = p.user_id WHERE (m.sender_id = %s AND m.receiver_id = %s) OR (m.sender_id = %s AND m.receiver_id = %s) ORDER BY m.created_at ASC", (user_id, other_user_id, other_user_id, user_id))
        messages = cur.fetchall()
        cur.execute("SELECT username FROM profile WHERE user_id = %s", (other_user_id,))
        other_user = cur.fetchone()
    except Error as e:
        print("DB error fetching conversation:", e)
        flash("Could not load conversation.", "danger")
    finally:
        if conn and conn.is_connected():
            cur.close()
            conn.close()
    return render_template('conversation.html', messages=messages, other_user=other_user, other_user_id=other_user_id)

@socketio.on('connect')
def handle_connect():
    user_id = session.get('user_id')
    if user_id:
        online_users[user_id] = request.sid
        print(f"User {user_id} connected with sid {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    # Find which user disconnected and remove them from the online list
    for user_id, sid in list(online_users.items()):
        if sid == request.sid:
            del online_users[user_id]
            print(f"User {user_id} disconnected.")
            break

if __name__ == "__main__":
    socketio.run(app, debug=True)
