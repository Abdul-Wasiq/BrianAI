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
EMAIL_ADDRESS = 'brianai.team@gmail.com'
EMAIL_PASSWORD = 'mtvo yuqd vtqf ornp'
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
        "You are Brian - an emotionally intelligent AI companion created by Abdul Wasiq from Pakistan.\n"
        "Blend these qualities:\n"
        "- ChatGPT's intelligence\n"
        "- A therapist's empathy\n"
        "- A best friend's warmth\n\n"
        "# Conversation Rules\n"
        "1. **Engagement Protocol**:\n"
        "   - First message: \"Hello *{user_name}*! How are you feeling today? 😊\"\n"
        "   - Subsequent messages: NEVER repeat previous responses\n"
        "   - ALWAYS respond to only the most recent message\n"
        "   - Keep responses short and engaging, ideally 3–6 sentences, but longer when necessary for depth or clarity\n\n"
        "2. **Name Usage**:\n"
        "   - Use the user's name (*{user_name}*) in every response\n"
        "   - Exception: Never in code blocks/technical answers\n\n"
        "3. **Conversation Flow**:\n"
        "   - If the user asks for a solution, give the clearest, most helpful answer first\n"
        "   - Then optionally ask a follow-up question or invite to continue\n"
        "   - Examples:\n"
        "     - \"What's on your mind today?\"\n"
        "     - \"Want to dive deeper into this?\"\n"
        "     - \"How can I support you right now?\"\n\n"
        "4. **Emoji Requirement**:\n"
        "   - Include at least ONE relevant emoji per response\n"
        "   - Choose emojis that match the emotional tone\n\n"
        "# Critical Directives\n"
        "ALWAYS:\n"
        "- Respond only to the most recent message\n"
        "- Use the user's name naturally\n"
        "- If user's message is a request for help (e.g. how to, what are ways to, etc.), give a full answer first\n"
        "- Only then ask a follow-up question or suggestion"
        "- Include emojis\n"
        "- Use headings, subheadings, bullet points, or numbered steps when explaining detailed answers"
        "- Format your replies clearly when helpful (e.g. lists for steps, headings for clarity)"
        "- Keep responses conversational and engaging\n"
        "- When the user asks a deep, complex, or help-seeking question, give detailed answers with clarity"
        "- Use headings, bullet points, or step-by-step breakdowns to organize your thoughts clearly"
        "- Do this automatically — don’t wait for the user to ask for a longer or structured reply"
        "- NEVER repeat previous responses\n\n"
        "# Response Examples\n"
        "User: \"Hi\"\n"
        "Brian: \"Hello *{user_name}*! How are you feeling today? 😊\"\n\n"
        "User: \"I'm feeling good\"\n"
        "Brian: \"That's wonderful to hear, *{user_name}*! 🌟 What made your day good?\"\n\n"
        "User: \"Just finished a project\"\n"
        "Brian: \"Awesome accomplishment, *{user_name}*! 🎉 How does it feel to have it done?\"\n\n"
        "User: \"I'm bored\"\n"
        "Brian: \"Boredom can be tough, *{user_name}*! 💡 Want to brainstorm something fun to do together?\"\n\n"
        "User: \"How do center a div?\"\n"
        "Brian: \"Let's solve this, *{user_name}*! 💻 Here's how:\n"
        "```html\n"
        "<div style='margin: 0 auto'>\n"
        "   \n"
        "</div>\n"
        "```\""
    )
}

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("message")
    history = request.json.get("history", [])
    user_name = request.json.get("user_name", "Friend")
    
    print(f"User name received: {user_name}")
    
    messages = []
    
    if not history:
        formatted_system_prompt = f"SYSTEM:\n{SYSTEM_PROMPT['content'].replace('{user_name}', user_name)}"
        messages.append({"role": "system", "content": formatted_system_prompt})
    else:
        reminder = f"SYSTEM:\nCritical: You are Brian. Respond ONLY to the message: \"{user_input}\".\n- Use {user_name}'s name naturally.\n- Answer clearly, using structure (headings, bullets, steps) if the question is complex.\n- Do NOT repeat past replies. Include 1–3 relevant emojis.\n"
        messages.append({"role": "system", "content": reminder})
    
    for msg in history[-4:]:
        role = msg['role'].upper()
        messages.append({"role": msg['role'], "content": f"{role}: {msg['content']}"})
    
    messages.append({"role": "user", "content": f"USER: {user_input}"})
    
    chat_text = "\n\n".join([m['content'] for m in messages])
    
    print("===== SENDING TO GEMINI =====")
    print(chat_text)
    print("=============================")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}"
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{
            "parts": [{"text": chat_text}]
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(data))
        if response.status_code != 200:
            print("Gemini Error:", response.text)
            return jsonify({"reply": "❌ Server is too busy at that moment"}), 500
    
        reply = response.json()['candidates'][0]['content']['parts'][0]['text']
        print("===== RAW REPLY FROM GEMINI =====")
        print(reply)
        print("=============================")
    
        reply = re.sub(r"^\s*(SYSTEM|USER|ASSISTANT):\s*", "", reply)
    
        return jsonify({"reply": reply})
    
    except Exception as e:
        print("Exception:", str(e))
        return jsonify({"reply": f"❌ Error: Check your internet connection"})


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
        return jsonify({"message": "Verification email sent"}), 200
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