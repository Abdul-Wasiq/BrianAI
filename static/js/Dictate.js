// static/js/Dictate.js
class Dictate {
    constructor(statusElId, outputElId) {
        this.statusEl = document.getElementById(statusElId);
        this.outputEl = document.getElementById(outputElId);
        this.transcript = ""; // store last result

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.statusEl.textContent = "Status: Browser does not support speech recognition.";
            this.recognition = null;
        } else {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                this.transcript = event.results[0][0].transcript;
                this.outputEl.innerHTML = `<strong>${this.transcript}</strong>`;
                this.statusEl.textContent = "Status: Success!";
            };

            this.recognition.onerror = (event) => {
                this.statusEl.textContent = `Status: Error: ${event.error}`;
            };

            this.recognition.onend = () => {
                this.statusEl.textContent = "Status: Listening stopped.";
            };
        }
    }

    start() {
        if (!this.recognition) return;
        this.recognition.start();
    }

    stop() {
        if (!this.recognition) return;
        this.recognition.stop();
        this.statusEl.textContent = "Status: Manually stopped.";
    }

    getTranscript() {
        return this.transcript;
    }
}

window.Dictate = Dictate;
