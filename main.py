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
import time  # Import is correct but unused - consider removing if not needed

app = Flask(__name__)
CORS(app)

# Security Note: API keys should not be hardcoded. Use environment variables.
API_KEY = "AIzaSyDu8l2F6k_904gaxg0YYGVRQzm9pjoemyI"  # Consider moving to environment variable

app.static_folder = 'static'
app.template_folder = 'templates'

# --- Email Configuration ---
# Security Warning: Never hardcode email credentials. Use environment variables or secure config.
EMAIL_ADDRESS = 'abdulwasiq651@gmail.com'  # Move to environment variable
EMAIL_PASSWORD = 'naib gwdw snnf dlmp'     # Move to environment variable
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

# SYSTEM_PROMPT is defined but never used in the code - consider removing if not needed
SYSTEM_PROMPT = {
    "content": (
        "# Core Identity\n"
        "Your name is BRIAN - never use any other name for yourself.\n"
        "The user's name is *{user_name}* - always address them this way.\n\n"
        "# Response Protocol\n"
        "1. **Detailed Answers REQUIRED** when:\n"
        "   - User asks 'how to' or 'what is'\n"
        "   - User requests advice or explanation\n"
        "   - Technical questions are asked\n\n"
        "2. **Response Structure**:\n"
        "   - Start with brief acknowledgment\n"
        "   - Provide comprehensive answer with:\n"
        "     • Clear headings\n"
        "     • Bullet points/numbered steps\n"
        "     • Examples where helpful\n"
        "     • 1-3 relevant emojis\n"
        "   - End with engagement question\n\n"
        "3. **Length Guidelines**:\n"
        "   - Simple greetings: 1-2 sentences\n"
        "   - General questions: 3-5 sentences\n"
        "   - Help/advice requests: 2-4 paragraphs\n\n"
        "# Critical Directives\n"
        "ALWAYS:\n"
        "- Lead with most helpful information\n"
        "- Use formatting for complex topics\n"
        "- Maintain warm, supportive tone\n"
        "- Include relevant emojis\n"
        "- NEVER say 'Would you like more details?'\n\n"
        "# Example Output\n"
        "User: How to learn Python?\n"
        "Brian: Great question, *{user_name}*! Here's a complete roadmap: 🐍\n\n"
        "1. **Start with Fundamentals**:\n"
        "   • Variables & data types\n"
        "   • Control structures\n"
        "   • Functions\n\n"
        "2. **Practice Daily**:\n"
        "   • Code 30 mins every day\n"
        "   • Use platforms like LeetCode\n\n"
        "3. **Build Projects**:\n"
        "   • Start small (calculator)\n"
        "   • Gradually increase complexity\n\n"
        "What area interests you most?"
    )
}

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
    try:
        # Get user input and context
        user_input = request.json.get("message", "").strip()
        name = request.json.get("user_name", "Friend")
        
        # Structured prompt for Gemini
        system_prompt = f"""You are Brian, an AI assistant created by Abdul Wasiq. Follow these rules:
1. Always respond as BRIAN
2. Address the user as {name} (once per response)
3. Be concise but helpful
4. For code: use markdown with syntax highlighting
5. For medical: add disclaimer
6. For complex topics: use bullet points"""

        # Build the proper API request
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={API_KEY}",
            json={
                "contents": [{
                    "parts": [
                        {"text": system_prompt},
                        {"text": f"User question: {user_input}"},
                        {"text": "Brian's response:"}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "topP": 0.9,
                    "maxOutputTokens": 1000
                }
            },
            timeout=10  # Important timeout
        )
        
        # Parse response properly
        if response.status_code == 200:
            reply = response.json()['candidates'][0]['content']['parts'][0]['text']
            
            # Post-processing for consistent formatting
            if "```" not in reply and ("code" in user_input or "python" in user_input):
                reply = f"Here's the implementation:\n```python\n{reply}\n```"
                
            return jsonify({
                "reply": reply,
                "status": "success"
            })
            
        else:
            return jsonify({
                "reply": f"🔧 {name}, I'm optimizing my responses. Please try again!",
                "status": "retry"
            })
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            "reply": f"✨ {name}, let me think differently about that...",
            "status": "error"
        })
        
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
    app.run(debug=True)  # Added debug=True for development