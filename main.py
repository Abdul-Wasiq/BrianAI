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
    user_input = request.json.get("message", "").strip()
    history = request.json.get("history", [])
    user_data = request.json.get("user_data", {})
    
    # Get names
    full_name = user_data.get('full_name', request.json.get("user_name", "Friend")).strip()
    preferred_name = get_preferred_name(full_name) if full_name != "Friend" else "Friend"
    
    # ====== SPECIAL CASE HANDLING ======
    # 1. Thank you detection
    thank_you_phrases = ["thank", "thanks", "appreciate", "grateful"]
    if any(phrase in user_input.lower() for phrase in thank_you_phrases):
        return jsonify({
            "reply": f"You're very welcome, {preferred_name}! 😊 Let me know if you need anything else."
        })
    
    # 2. Greeting detection
    greeting_phrases = ["hi", "hello", "hey"]
    is_greeting = any(phrase in user_input.lower() for phrase in greeting_phrases) and len(history) < 2
    
    # ====== CONVERSATION CONTEXT ======
    # Build message history intelligently
    messages = []
    
    # System prompt with strict rules
    system_prompt = f"""You are Brian, an AI assistant. Strict rules:
1. NEVER use the user's name for yourself
2. ALWAYS say "I'm Brian" when relevant
3. Address the user as {preferred_name} (1-2 times per response max)
4. Current conversation summary: {history[-1]['content'][:100] if history else 'New conversation'}
    
Response Guidelines:
- Be concise yet helpful
- NEVER repeat previous answers
- Format complex answers with bullet points
- Include 1 relevant emoji"""
    
    messages.append({"role": "system", "content": system_prompt})
    
    # Add only relevant history (last 2-3 exchanges)
    for msg in history[-4:]:
        if msg['role'] == 'assistant':
            # Clean any incorrect name usage
            content = re.sub(r"I'm (?!Brian\b)\w+", "I'm Brian", msg['content'], flags=re.IGNORECASE)
        else:
            content = msg['content']
        messages.append({"role": msg['role'], "content": content})
    
    # Add current message
    messages.append({"role": "user", "content": user_input})
    
    # ====== API CALL ======
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}"
        headers = {"Content-Type": "application/json"}
        data = {
            "contents": [{
                "parts": [{"text": "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])}]
            }]
        }  # This was the missing closing brace
        
        response = requests.post(url, headers=headers, json=data)  # Changed to json= for better handling
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        reply = response.json()['candidates'][0]['content']['parts'][0]['text']
        
        # ====== POST-PROCESSING ======
        # 1. Enforce Brian's identity
        reply = re.sub(r"\b(I'm|I am|name is)\s+(?!Brian\b)\w+", "I'm Brian", reply, flags=re.IGNORECASE)
        
        # 2. Smart name replacement (much more precise)
        if preferred_name != "Friend":
            # Only replace when "you" is followed by a space and not part of another word
            reply = re.sub(
                r"(^|\W)you(\W)(?!\w*ing\b)(?!\w*ed\b)(?!name\b)", 
                f"\\1you {preferred_name}\\2", 
                reply, 
                flags=re.IGNORECASE
            )
            
            # Fix common phrases that shouldn't be replaced
            preserve_phrases = {
                "your mind": "your mind",
                "your life": "your life",
                "your code": "your code"
            }
            for phrase, replacement in preserve_phrases.items():
                reply = reply.replace(f"you {preferred_name} {phrase.split()[1]}", replacement)
        
        # 3. Ensure first message is proper greeting
        if is_greeting:
            reply = f"Hello {full_name}! I'm Brian. How can I help you today? 😊"
        
        # 4. Remove any duplicate name usage
        reply = re.sub(rf"\b{preferred_name}\b.*?\b{preferred_name}\b", preferred_name, reply)
        
        return jsonify({"reply": reply.strip()})
    
    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {str(e)}")
        return jsonify({"reply": "❌ I'm having trouble connecting to my servers. Please try again later."})
    except (KeyError, IndexError) as e:
        print(f"Response Parsing Error: {str(e)}")
        return jsonify({"reply": "❌ I didn't understand the response from my servers. Let me think differently..."})
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
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