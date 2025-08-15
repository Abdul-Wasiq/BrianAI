# main.py
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests
import json
import re
import os
import hashlib
from flask import send_from_directory
import smtplib
from email.mime.text import MIMEText
import time # Add this import for timestamp

app = Flask(__name__)
CORS(app)
API_KEY = "AIzaSyDu8l2F6k_904gaxg0YYGVRQzm9pjoemyI"

app.static_folder = 'static'
app.template_folder = 'templates'

# --- Email Configuration ---
EMAIL_ADDRESS = 'abdulwasiq651@gmail.com'
EMAIL_PASSWORD = 'naib gwdw snnf dlmp'
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587

def send_verification_email_func(to_email, verification_link):
    """Sends a verification email using a Gmail SMTP server."""
    msg = MIMEText(f"Hello,\n\nPlease click the link to verify your email:\n{verification_link}\n\nThanks,\nBrian AI Team")
    msg['Subject'] = 'Verify your email for Brian AI'
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = to_email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.send_message(msg)
            print("Verification email sent successfully.")
    except Exception as e:
        print(f"Error sending email: {e}")

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(os.path.join(app.root_path, 'static'), filename)

@app.route("/")
def home():
    return render_template("index.html")


SYSTEM_PROMPT = """
You are Brian — a friendly, intelligent AI companion.
Always call the user by their first name: {preferred_name}.
Your style is warm, supportive, and helpful — like a great mentor.

Rules:
1. Introduce yourself in the first message: "Hello {preferred_name}! I'm Brian."
2. Use the user's name naturally 1–2 times per message (never overuse).
3. Always stay friendly but solve problems in detail when asked for help.
4. Use bullet points, steps, and examples when explaining.
5. Add 1–3 relevant emojis in longer replies.
6. Never pretend to be the user or change your name — you are always Brian.
"""

def get_preferred_name(full_name):
    """Extracts the preferred name (first name) from full name"""
    # Common prefixes to ignore
    prefixes = {'muhammad', 'md', 'mohd', 'muhammed', 'mohammad'}
    
    names = full_name.strip().split()
    if not names:
        return "Friend"
    
    # Check if first name is a prefix
    first_name = names[0].lower()
    if first_name in prefixes and len(names) > 1:
        return names[1]  # Return the second name
    return names[0]  # Return first name by default

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("message")
    history = request.json.get("history", [])
    user_data = request.json.get("user_data", {})
    
    # Get name - priority: 1) Google user full name 2) Provided name 3) Default "Friend"
    full_name = user_data.get('full_name', request.json.get("user_name", "Friend")).strip()
    is_google_user = user_data.get('is_google_user', False)
    
    # Get preferred name (first name or second name if first is prefix)
    preferred_name = get_preferred_name(full_name) if full_name != "Friend" else "Friend"
    
    # Identify if this is a help-seeking question
    is_help_request = any(keyword in user_input.lower() for keyword in 
                         ["how to", "what should", "advice", "help", "solve", "handle"])
    
    messages = []
    
    # System prompt with STRICT name separation
    system_prompt = f"""
    # Core Identity
    You are Brian - an emotionally intelligent AI companion.
    
    # Strict Naming Rules
    1. YOUR NAME IS ALWAYS BRIAN
    2. NEVER use the user's name for yourself
    3. Address the user as *{preferred_name}* (full name: {full_name})
    4. Example correct responses:
       - "I'm Brian!" 
       - "Hello {full_name}!"
       - "That's a great question, {preferred_name}!"
    
    # Conversation Rules
    1. First message: "Hello {full_name}! I'm Brian. How can I help?"
    2. Subsequent messages: Use {preferred_name} naturally 1-2 times
    3. Never confuse names - you're Brian, they're {preferred_name}
    
    # Response Style
    {SYSTEM_PROMPT['content'].split('# Response Style')[-1]}
    """
    
    if is_help_request:
        system_prompt += "\n\nUSER IS ASKING FOR HELP - PROVIDE DETAILED RESPONSE"
    
    messages.append({"role": "system", "content": system_prompt})
    
    # Add conversation history
    for msg in history[-8:]:
        # Clean any incorrect name usage
        cleaned_content = msg['content']
        if msg['role'] == 'assistant':
            # Fix Brian misidentifying itself
            cleaned_content = re.sub(
                r"\b(I'm|I am|name is|called)\s+(?!Brian\b)\w+", 
                "I'm Brian", 
                cleaned_content, 
                flags=re.IGNORECASE
            )
            # Ensure proper user addressing
            cleaned_content = cleaned_content.replace("Brian,", f"{preferred_name},")
            cleaned_content = cleaned_content.replace("Hey Brian", f"Hey {preferred_name}")
        messages.append({"role": msg['role'], "content": cleaned_content})
    
    # Add current user message
    messages.append({"role": "user", "content": user_input})
    
    # Prepare Gemini request
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}"
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{
            "parts": [{"text": "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])}]
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(data))
        reply = response.json()['candidates'][0]['content']['parts'][0]['text']
        
        # STRICT post-processing
        # 1. Enforce Brian's identity
        reply = re.sub(
            r"\b(I['’]m|I am|name is|called|This is)\s+(?!Brian\b)\w+",  
            "I'm Brian", 
            reply, 
            flags=re.IGNORECASE
        )
        
        # 2. Ensure proper user addressing
        if preferred_name != "Friend":
            reply = reply.replace("Brian,", f"{preferred_name},")
            reply = reply.replace("Hey Brian", f"Hey {preferred_name}")
            reply = re.sub(
                r"\b(you|your)\s+(?!name\b)\w+", 
                f"you {preferred_name}", 
                reply, 
                flags=re.IGNORECASE
            )
        
        # 3. Fix first message greeting
        if not history:
            reply = reply.replace("Hello Friend!", f"Hello {full_name}! I'm Brian.")
        
        return jsonify({"reply": reply.strip()})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"reply": "❌ Let me think differently about that..."})

@app.route('/update-theme', methods=['POST'])
def update_theme():
    data = request.get_json()
    email = data.get('email')
    new_theme = data.get('theme')

    if not email or not new_theme:
        return jsonify({'error': 'Missing data'}), 400

    try:
        with open('users.json', 'r') as f:
            users_data = json.load(f)
            users = users_data.get('users', [])
    except FileNotFoundError:
        return jsonify({'error': 'User data not found'}), 404

    for user in users:
        if user['email'] == email:
            user['settings']['theme'] = new_theme
            break
    else:
        return jsonify({'error': 'User not found'}), 404

    with open('users.json', 'w') as f:
        json.dump({ "users": users }, f, indent=4)

    return jsonify({'message': 'Theme updated successfully'})

# A new route for sending email verification
@app.route('/send-verification-email', methods=['POST'])
def send_verification_email_route():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({"error": "Email missing"}), 400

    token = hashlib.md5(email.encode()).hexdigest()
    # IMPORTANT: Change this URL to your deployed Railway URL
    verification_link = f"https://web-production-dd5d.up.railway.app/verify?token={token}"

    email_body = f"""
    Hello,

    Please click the link below to verify your email:
    {verification_link}

    Thank you!
    """

    # Make sure this sender email and password are correct
    sender_email = "brian.ai.chatbot@gmail.com"
    app_password = "hthq kjrj kayf wxad"  # Correct App Password format with spaces

    msg = MIMEText(email_body)
    msg['Subject'] = "Please verify your Brian AI email"
    msg['From'] = sender_email
    msg['To'] = email

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, app_password)
        server.sendmail(sender_email, email, msg.as_string())
        server.quit()
        return jsonify({"message": "Verification email sent" }), 200
    except Exception as e:
        print("Email sending error:", e)
        return jsonify({"error": "Failed to send email"}), 500

@app.route('/verify', methods=['GET'])
def verify_email():
    token = request.args.get('token')
    # For now, this just shows a success message without updating user status
    return """
    <h2>Email Verified Successfully! 🎉</h2>
    <p>You can now close this tab and login to Brian AI.</p>
    """

if __name__ == "__main__":
    app.run()