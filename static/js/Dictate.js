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
    
    // Process all results since last event
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
            // ✅ FINAL result - add to permanent transcript
            this.transcript += transcriptChunk + " ";
        } else {
            // 🎯 INTERIM result - only for current preview
            interimTranscript = transcriptChunk;
        }
    }
    
    // 👇 Show confirmed text + current interim preview
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
