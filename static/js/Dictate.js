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

        this.recognition.onresult = (event) => {
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
            // ✅ Save only final confirmed results
            this.transcript += transcriptChunk + " ";
        } else {
            // ⚡ Temporary text while user is still speaking
            interimTranscript += transcriptChunk;
        }
    }

    // Optional: show live text in input box
    document.getElementById('userInput').value = this.transcript + interimTranscript;
    adjustTextareaHeight();
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
