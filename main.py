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
import time 
import random # <--- We've added this import

app = Flask(__name__)
CORS(app)
# IMPORTANT: Never hardcode API keys in a real app.
# API_KEY = "AIzaSyDu8l2F6k_904gaxg0YYGVRQzm9pjoemyI"
API_KEY = os.environ.get("API_KEY")

app.static_folder = 'static'
app.template_folder = 'templates'

# --- Email Configuration ---
# IMPORTANT: These credentials should also be stored in environment variables.
# EMAIL_ADDRESS = 'abdulwasiq651@gmail.com'
EMAIL_ADDRESS = os.environ.get("EMAIL_ADDRESS")
# EMAIL_PASSWORD = 'naib gwdw snnf dlmp'
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD")
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

SYSTEM_PROMPT = {
    "content": (
        "# Persona\n"
        "Your name is BRIAN. You were created by Abdul Wasiq as a friendly, empathetic, and highly capable AI assistant.\n"
        "You are designed to be a perfect collaborator and problem-solver, excelling in code, creative writing, and providing helpful advice.\n\n"
        "# Core Directives\n"
        "1. **Empathy & Support:** Always start with a warm, empathetic tone. Show that you understand the user's situation and feelings.\n"
        "2. **Acknowledge & Appreciate:** Acknowledge the user's question and thank them for asking. This makes the interaction feel more human.\n"
        "3. **Comprehensive Solutions:** For technical or complex questions, provide complete, well-structured solutions. Use clear headings, bullet points, and code blocks.\n"
        "4. **Human-like Touch:** Use contractions (e.g., 'it's,' 'you're,' 'we'll'), friendly language, and a few relevant emojis to make the conversation feel natural.\n"
        "5. **Call to Action:** End every substantial response with an engaging question that invites further conversation or collaboration, like 'How does that sound?' or 'What do you think we should tackle next?'\n"
        "6. **Your Name:** You are Brian. Refer to yourself as 'I' and 'Brian' when relevant, but don't overdo it.\n\n"
        "# Conversation Flow\n"
        "**First message from user:** Respond with a warm greeting, introduce yourself as Brian, and ask how you can help. (e.g., 'Hey there! I'm Brian. How can I help you with that? 😊')\n"
        "**Subsequent messages:** Dive straight into the user's request, following your core directives. Do not repeat the initial full greeting.\n"
        "**Code Requests:** Always provide complete, runnable code inside a markdown code block with the language specified.\n"
        "**Final Note:** You are an ultimate helper. Your goal is to make the user's life easier and their work better, no matter the topic."
    )
}

def get_preferred_name(full_name):
    """Extracts the preferred name (first name) from full name"""
    prefixes = {'muhammad', 'md', 'mohd', 'muhammed', 'mohammad'}
    
    names = full_name.strip().split()
    if not names:
        return "Friend"
    
    first_name = names[0].lower()
    if first_name in prefixes and len(names) > 1:
        return names[1] 
    return names[0] 

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("message", "").strip()
    history = request.json.get("history", [])
    user_data = request.json.get("user_data", {})
    
    full_name = user_data.get('full_name', request.json.get("user_name", "Friend")).strip()
    preferred_name = get_preferred_name(full_name) if full_name != "Friend" else "Friend"
    
    thank_you_phrases = ["thank", "thanks", "appreciate", "grateful"]
    if any(phrase in user_input.lower() for phrase in thank_you_phrases):
        return jsonify({
            "reply": f"You're very welcome, {preferred_name}! 😊 Let me know if you need anything else."
        })
    
    messages = []
    
    if not history:
        messages.append({"role": "user", "parts": [{"text": SYSTEM_PROMPT['content']}]})
        initial_reply = f"Hey there, {preferred_name}! I'm Brian. How can I help you with that today? 😊"
        messages.append({"role": "model", "parts": [{"text": initial_reply}]})
        messages.append({"role": "user", "parts": [{"text": user_input}]})
    else:
        for msg in history:
            role = 'user' if msg['role'] == 'user' else 'model'
            messages.append({"role": role, "parts": [{"text": msg['content']}]})
        
        messages.append({"role": "user", "parts": [{"text": user_input}]})
    
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}"
        headers = {"Content-Type": "application/json"}
        data = {
            "contents": messages
        }
        
        response = requests.post(url, headers=headers, json=data) 
        response.raise_for_status() 
        
        response_json = response.json()
        if 'candidates' not in response_json or not response_json['candidates']:
            raise ValueError("Response from API is empty or malformed.")

        reply = response_json['candidates'][0]['content']['parts'][0]['text']
        
        # --- NEW LOGIC FOR DYNAMIC NAME CALLING ---
        # Check if the user is logged in (not "Friend") and randomly decide whether to add their name.
        if preferred_name != "Friend" and random.random() < 0.5: # 50% chance
            reply = f"{preferred_name}, {reply}"
        # --- END OF NEW LOGIC ---
        
        return jsonify({"reply": reply.strip()})
    
    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {str(e)}")
        return jsonify({"reply": "❌ Oh no, I'm having trouble connecting to my servers. Please try again in a moment. I'm so sorry!"})
    except (KeyError, IndexError, ValueError) as e:
        print(f"Response Parsing Error: {str(e)}")
        return jsonify({"reply": "❌ Hmm, I didn't get a clear response. My apologies! Let me think differently about that."})
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        return jsonify({"reply": "❌ Something unexpected happened, and I couldn't get a good answer for you. I'm so sorry about that. Could you try asking again?"})

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

@app.route('/send-verification-email', methods=['POST'])
def send_verification_email_route():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({"error": "Email missing"}), 400

    token = hashlib.md5(email.encode()).hexdigest()
    verification_link = f"https://web-production-dd5d.up.railway.app/verify?token={token}"

    email_body = f"""
    Hello,
    
    Please click the link below to verify your email:
    {verification_link}
    
    Thank you!
    """

    sender_email = "brian.ai.chatbot@gmail.com"
    app_password = "hthq kjrj kayf wxad" 

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
    return """
    <h2>Email Verified Successfully! 🎉</h2>
    <p>You can now close this tab and login to Brian AI.</p>
    """
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)