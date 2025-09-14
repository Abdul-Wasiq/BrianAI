class Dictate {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("❌ Browser does not support SpeechRecognition.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.finalTranscript = ""; // Use a separate variable for final, confirmed text

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    // This is a new FINAL segment, so append it to our permanent transcript
                    this.finalTranscript += event.results[i][0].transcript;
                } else {
                    // This is an interim segment, just store it to display temporarily
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Update the input field with the combined text
            document.getElementById("userInput").value = this.finalTranscript + interimTranscript;
            adjustTextareaHeight();
        };

        this.recognition.onerror = (event) => {
            console.error("❌ SpeechRecognition Error:", event.error);
        };
    }

    start() {
        console.log("▶️ Dictation started...");
        this.finalTranscript = ""; // Reset transcript on start
        this.recognition.start();
    }

    stop() {
        console.log("⏹️ Dictation stopped.");
        this.recognition.stop();
    }

    getTranscript() {
        // Return the full, final transcript
        return this.finalTranscript.trim();
    }

    clearTranscript() {
        this.finalTranscript = "";
    }
}

window.dictate = new Dictate();