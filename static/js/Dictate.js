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
        const transcriptChunk = event.results[i][0].transcript.trim();

        if (event.results[i].isFinal) {
            // ✅ Save confirmed text ONCE
            this.transcript += transcriptChunk + " ";
        } else {
            // 👀 Just preview, don't save permanently
            interimTranscript = transcriptChunk;
        }
    }

    // 👇 Always show: confirmed text + live preview
    document.getElementById("userInput").value =
        (this.transcript + interimTranscript).trim();
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
