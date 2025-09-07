// static/js/Dictate.js
// This is the module for our Dictate feature.

class Dictate {
    constructor() {
        console.log("✅ Dictate Module has been loaded successfully!");
        this.isListening = false; // Simple state flag
    }

    // A simple method we can call to test our connection
    testConnection() {
        console.log("🔊 Dictate.testConnection() was called! Everything is linked up.");
        return "This text came from the Dictate module!";
    }
}

// This line makes the class available for import
export default Dictate;