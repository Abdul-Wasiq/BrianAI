// static/js/Dictate.js
class Dictate {
    constructor() {
        this.transcript = ""; // store the latest recognized text

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error("❌ Browser does not support speech recognition.");
            this.recognition = null;
        } else {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                this.transcript = event.results[0][0].transcript;
                console.log("🎤 Transcript:", this.transcript);
            };

            this.recognition.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
            };
        }
    }

    start() {
        if (!this.recognition) return;
        this.transcript = ""; // reset before each start
        this.recognition.start();
    }

    stop() {
        if (!this.recognition) return;
        this.recognition.stop();
    }

    getTranscript() {
        return this.transcript;
    }
}

window.Dictate = Dictate;
