from flask import Flask, render_template, request, redirect, url_for, flash, session
import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Secure random secret key for sessions; store safely in prod

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
    return dict(session=session)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/get-involved', methods=['GET', 'POST'])
def get_involved_page():
    if 'user_id' in session:
        return redirect(url_for('my_profile_page'))

    if request.method == 'POST':
        form_type = request.form.get('form_type')
        conn = get_db_connection()
        if not conn:
            flash("Database connection failed.", "danger")
            return render_template('get-involved.html')

        try:
            if form_type == 'signup':
                username = request.form.get('signup-name', '').strip()
                email = request.form.get('signup-email', '').strip().lower()
                password = request.form.get('signup-password', '')
                confirm = request.form.get('signup-confirm-password', '')
                dob = request.form.get('signup-dob')
                gender = request.form.get('signup-gender')
                contact = request.form.get('signup-contact')
                city = request.form.get('signup-city', '').strip()
                blood_group = request.form.get('signup-bloodgroup')

                if not all([username, email, password, dob, gender, contact, city, blood_group]):
                    flash("Please fill all signup fields.", "warning")
                    return render_template('get-involved.html')
                if password != confirm:
                    flash("Passwords do not match.", "warning")
                    return render_template('get-involved.html')

                cur = conn.cursor()
                cur.execute("SELECT user_id FROM profile WHERE email=%s", (email,))
                if cur.fetchone():
                    flash("Username or email already exists.", "warning")
                    cur.close()
                    return render_template('get-involved.html')

                conn.start_transaction()

                hashed = generate_password_hash(password)

                cur.execute("INSERT INTO profile (username, email, password) VALUES (%s, %s, %s)", (username, email, hashed))
                profile_id = cur.lastrowid

                cur.execute(
                    "INSERT INTO donor (profile_id, name, dob, gender, contact, city, blood_group) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (profile_id, username, dob, gender, contact, city, blood_group)
                )

                conn.commit()
                cur.close()
                flash("Signup successful! Please log in.", "success")
                return redirect(url_for('get_involved_page'))

            elif form_type == 'login':
                identifier = request.form.get('login-email', '').strip()
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
                cur.close()

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
            print(f"DB error on {form_type}:", e)
            flash("A database error occurred.", "danger")
        finally:
            if conn and conn.is_connected():
                conn.close()

    return render_template('get-involved.html')

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
        city = request.form.get('city')
        dob = request.form.get('dob')
        blood_group = request.form.get('bloodgroup')

        try:
            cur = conn.cursor()
            cur.execute("UPDATE profile SET username=%s, email=%s WHERE user_id=%s", (fullname, email, user_id))
            cur.execute(
                "UPDATE donor SET name=%s, contact=%s, city=%s, dob=%s, blood_group=%s WHERE profile_id=%s",
                (fullname, phone, city, dob, blood_group, user_id)
            )
            session['username'] = fullname
            cur.close()
            conn.commit()
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
            SELECT p.username, p.email, d.name, d.dob, d.gender, d.blood_group, d.city, d.contact, d.profile_picture_url
            FROM profile p LEFT JOIN donor d ON p.user_id = d.profile_id WHERE p.user_id = %s
        """, (user_id,))
        user_data = cur.fetchone()
        cur.close()
    except Error as e:
        print("DB error fetching profile:", e)
        flash("Could not load your profile.", "danger")
        user_data = None
    finally:
        if conn.is_connected():
            conn.close()

    return render_template('my-profile.html', user=user_data)


@app.route('/logout')
def logout():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for('home'))


if __name__ == "__main__":
    app.run(debug=True)
