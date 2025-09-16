class Dictate {
    constructor() {
        this.finalTranscript = '';
        this.isListening = false;
        
        // Check if the browser supports the Web Speech API
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            
            this.recognition.lang = 'en-US';
            this.recognition.continuous = true;
            this.recognition.interimResults = true;

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                // Reset finalTranscript to only contain the full, final result
                this.finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        this.finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                // Update the input field with the live interim and final transcript
                document.getElementById('userInput').value = this.finalTranscript + interimTranscript;
            };

            this.recognition.onstart = () => {
                this.isListening = true;
                console.log('🎙️ Listening...');
            };

            this.recognition.onend = () => {
                this.isListening = false;
                console.log('🛑 Dictation stopped.');
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
            };
        } else {
            console.error('Speech Recognition is not supported in this browser.');
            this.recognition = null;
        }
    }

    // Method to start dictation
    start() {
        if (this.recognition && !this.isListening) {
            this.recognition.start();
        }
    }

    // Method to stop dictation
    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    // Method to toggle dictation on and off
    toggle() {
      if (this.isListening) {
          this.stop();
          return false;
      } else {
          this.start();
          return true;
      }
    }

    // Method to get the full transcript
    getTranscript() {
        return this.finalTranscript;
    }

    // Method to clear the transcript
    clearTranscript() {
        this.finalTranscript = '';
    }
}