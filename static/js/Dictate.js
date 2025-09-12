class Dictate {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("❌ Browser does not support SpeechRecognition.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;  // keep listening
        this.recognition.interimResults = true; // show words as user speaks
        this.transcript = "";

        // When speech result is detected
        this.recognition.onresult = (event) => {
            let finalTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptChunk = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.transcript += transcriptChunk + " ";
                } else {
                    finalTranscript += transcriptChunk;
                }
            }
            console.log("🎙️ Transcript:", this.transcript + finalTranscript);
        };

        this.recognition.onerror = (event) => {
            console.error("❌ SpeechRecognition Error:", event.error);
        };
    }

    start() {
        console.log("▶️ Dictation started...");
        this.transcript = "";
        this.recognition.start();
    }

    stop() {
        console.log("⏹️ Dictation stopped.");
        this.recognition.stop();
    }

    getTranscript() {
        return this.transcript.trim();
    }

    clearTranscript() {
        this.transcript = "";
    }
}

window.dictate = new Dictate();
